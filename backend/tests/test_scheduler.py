"""
Tests for the auto-approval scheduler (run_auto_approval).

Directly calls run_auto_approval(db=...) rather than spinning up the
BackgroundScheduler so tests remain fast and fully isolated.
"""

import pytest
from datetime import date, timedelta
from .conftest import REQUEST_PAYLOAD
from scheduler import run_auto_approval
import models


# ── Helper ─────────────────────────────────────────────────────────────────

def _create_request(client, headers, **overrides) -> str:
    payload = {**REQUEST_PAYLOAD, **overrides}
    resp = client.post("/api/requests", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]

def _create_lot(client, manager_headers, lot_id="LOT-TEST") -> str:
    resp = client.post("/api/lots", json={
        "id":          lot_id,
        "floor":       "F1",
        "floor_label": "Floor 1",
        "status":      "available",
    }, headers=manager_headers)
    assert resp.status_code == 201
    return lot_id


# ── Auto-approval: no conflict ─────────────────────────────────────────────

def test_auto_approve_pending_request_no_lot(client, db_session, user_headers, manager_headers):
    """A pending request with no lot_id finds the first available lot and is approved."""
    lot_id = _create_lot(client, manager_headers)
    req_id = _create_request(client, user_headers)

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    assert resp.status_code == 200
    approved = resp.json()
    assert any(r["id"] == req_id for r in approved)
    req = next(r for r in approved if r["id"] == req_id)
    assert req["lot_id"] == lot_id


def test_auto_approved_sets_approved_by_auto(client, db_session, user_headers, manager_headers):
    """approved_by is set to 'auto' by the scheduler."""
    _create_lot(client, manager_headers)
    req_id = _create_request(client, user_headers)

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    req = next(r for r in resp.json() if r["id"] == req_id)
    assert req["approved_by"] == "auto"
    assert req["approved_at"] is not None


def test_auto_approve_multiple_non_conflicting_requests(client, db_session, user_headers, manager_headers):
    """Multiple pending requests are matched with available lots."""
    _create_lot(client, manager_headers, "LOT-1")
    _create_lot(client, manager_headers, "LOT-2")
    
    _FUTURE_DATE = (date.today() + timedelta(days=7)).isoformat()
    id1 = _create_request(client, user_headers, start_time="09:00", end_date=_FUTURE_DATE, end_time="10:00", duration=1)
    id2 = _create_request(client, user_headers, start_time="10:00", end_date=_FUTURE_DATE, end_time="11:00", duration=1)

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    approved_ids = [r["id"] for r in resp.json()]
    assert id1 in approved_ids
    assert id2 in approved_ids


# ── Lot Assignment ─────────────────────────────────────────────────────────

def test_auto_approve_assigns_available_lot(client, db_session, manager_headers, user_headers):
    """A pending request with no lot_id should be assigned the first available lot."""
    lot_id = "LOT-AUTO-ASSIGN"
    _create_lot(client, manager_headers, lot_id)

    req_id = _create_request(client, user_headers)

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    req = next(r for r in resp.json() if r["id"] == req_id)
    assert req["lot_id"] == lot_id
    assert req["status"] == "approved"


# ── Multi-day Conflict detection ───────────────────────────────────────────

def test_auto_approve_multi_day_overhang_conflict(client, db_session, user_headers, owner_headers, manager_headers):
    """
    A multi-day request starting Day 1 blocks a single-day request on Day 2 if it's still ongoing.
    """
    lot_id = "LOT-MULTI"
    _create_lot(client, manager_headers, lot_id)

    d1 = (date.today() + timedelta(days=1)).isoformat()
    d2 = (date.today() + timedelta(days=2)).isoformat()

    # Request 1: Day 1 20:00 to Day 2 08:00 (12h) - already approved
    id1 = _create_request(client, user_headers, date=d1, start_time="20:00", end_date=d2, end_time="08:00", duration=12)
    client.patch(
        f"/api/requests/{id1}/approve",
        json={"lot_id": lot_id, "floor": "F1", "lot_owner": "Admin"},
        headers=manager_headers,
    )

    # Request 2: Day 2 07:00 to Day 2 09:00 (2h) - overlaps at 07:00-08:00
    id2 = _create_request(client, user_headers, date=d2, start_time="07:00", end_date=d2, end_time="09:00", duration=2)
    
    # Point it to the same lot for conflict test
    req2 = db_session.query(models.ParkingRequest).filter(models.ParkingRequest.id == id2).first()
    req2.lot_id = lot_id
    db_session.commit()

    run_auto_approval(db=db_session)

    # id2 must still be pending
    resp = client.get("/api/requests/pending", headers=user_headers)
    pending_ids = [r["id"] for r in resp.json()]
    assert id2 in pending_ids


# ── Oldest submission wins ─────────────────────────────────────────────────

def test_oldest_submission_wins_on_conflict(client, db_session, user_headers, manager_headers):
    """
    Two pending requests for the same duration: REQ-001 approved, REQ-002 skipped.
    """
    lot_id = "LOT-SINGLE"
    _create_lot(client, manager_headers, lot_id)
    
    _FUTURE_DATE = (date.today() + timedelta(days=7)).isoformat()

    id1 = _create_request(client, user_headers, start_time="09:00", end_date=_FUTURE_DATE, end_time="11:00", duration=2, lot_id=lot_id)
    id2 = _create_request(client, user_headers, start_time="09:00", end_date=_FUTURE_DATE, end_time="11:00", duration=2, lot_id=lot_id)

    run_auto_approval(db=db_session)

    approved = client.get("/api/requests/approved", headers=user_headers).json()
    pending  = client.get("/api/requests/pending",  headers=user_headers).json()

    approved_ids = [r["id"] for r in approved]
    pending_ids  = [r["id"] for r in pending]

    assert id1 in approved_ids
    assert id2 in pending_ids


def test_auto_approve_idempotent_on_approved_requests(client, db_session, user_headers, manager_headers):
    """Running the scheduler twice does not double-process already-approved requests."""
    _create_lot(client, manager_headers)
    req_id = _create_request(client, user_headers)

    run_auto_approval(db=db_session)
    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    ids = [r["id"] for r in resp.json()]
    assert ids.count(req_id) == 1
