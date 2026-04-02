"""
Tests for the auto-approval scheduler (run_auto_approval).

Directly calls run_auto_approval(db=...) rather than spinning up the
BackgroundScheduler so tests remain fast and fully isolated.
"""

import pytest
from .conftest import REQUEST_PAYLOAD
from scheduler import run_auto_approval


# ── Helper ─────────────────────────────────────────────────────────────────

def _create_request(client, headers, **overrides) -> str:
    payload = {**REQUEST_PAYLOAD, **overrides}
    resp = client.post("/api/requests", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ── Auto-approval: no conflict ─────────────────────────────────────────────

def test_auto_approve_pending_request_no_lot(client, db_session, user_headers):
    """A pending request with no lot_id has no possible conflict → auto-approved."""
    req_id = _create_request(client, user_headers)

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    assert resp.status_code == 200
    approved_ids = [r["id"] for r in resp.json()]
    assert req_id in approved_ids


def test_auto_approved_sets_approved_by_auto(client, db_session, user_headers):
    """approved_by is set to 'auto' by the scheduler."""
    req_id = _create_request(client, user_headers)

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    req = next(r for r in resp.json() if r["id"] == req_id)
    assert req["approved_by"] == "auto"
    assert req["approved_at"] is not None


def test_auto_approve_multiple_non_conflicting_requests(client, db_session, user_headers):
    """Multiple pending requests with no lot conflict are all auto-approved."""
    id1 = _create_request(client, user_headers, start_time="09:00", end_time="10:00", duration=1)
    id2 = _create_request(client, user_headers, start_time="11:00", end_time="13:00", duration=2)

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    approved_ids = [r["id"] for r in resp.json()]
    assert id1 in approved_ids
    assert id2 in approved_ids


# ── Conflict detection ─────────────────────────────────────────────────────

def test_auto_approve_skips_conflicting_request(client, db_session, user_headers, owner_headers):
    """
    A pending request whose lot_id/date/time conflicts with an already-approved
    request is skipped (left pending for manual review).
    """
    # First request: manually approved with a specific lot
    id1 = _create_request(client, user_headers, start_time="09:00", end_time="11:00", duration=2)
    client.patch(
        f"/api/requests/{id1}/approve",
        json={"lot_id": "F1-001", "floor": "F1", "lot_owner": "Bob Owner"},
        headers=owner_headers,
    )

    # Second pending request: same lot, same date, overlapping time
    id2 = _create_request(client, user_headers, start_time="10:00", end_time="12:00", duration=2)
    # Set lot_id on the pending request directly so the scheduler's conflict check fires
    import models
    req2 = db_session.query(models.ParkingRequest).filter(models.ParkingRequest.id == id2).first()
    req2.lot_id = "F1-001"
    db_session.commit()

    run_auto_approval(db=db_session)

    # id2 must still be pending
    resp = client.get("/api/requests/pending", headers=user_headers)
    pending_ids = [r["id"] for r in resp.json()]
    assert id2 in pending_ids


def test_auto_approve_no_conflict_adjacent_slots(client, db_session, user_headers, owner_headers):
    """Adjacent (non-overlapping) slots on the same lot → no conflict → auto-approved."""
    # Approve first request for 09:00–11:00
    id1 = _create_request(client, user_headers, start_time="09:00", end_time="11:00", duration=2)
    client.patch(
        f"/api/requests/{id1}/approve",
        json={"lot_id": "F1-001", "floor": "F1", "lot_owner": "Bob Owner"},
        headers=owner_headers,
    )

    # Second pending request: same lot, adjacent time (11:00–13:00)
    id2 = _create_request(client, user_headers, start_time="11:00", end_time="13:00", duration=2)
    import models
    req2 = db_session.query(models.ParkingRequest).filter(models.ParkingRequest.id == id2).first()
    req2.lot_id = "F1-001"
    db_session.commit()

    run_auto_approval(db=db_session)

    resp = client.get("/api/requests/approved", headers=user_headers)
    approved_ids = [r["id"] for r in resp.json()]
    assert id2 in approved_ids


# ── Oldest submission wins ─────────────────────────────────────────────────

def test_oldest_submission_wins_on_conflict(client, db_session, user_headers):
    """
    Two pending requests for the same lot/date/time:
    the one submitted first (REQ-001) is auto-approved;
    the one submitted second (REQ-002) is skipped due to the now-approved conflict.
    """
    import models

    id1 = _create_request(client, user_headers, start_time="09:00", end_time="11:00", duration=2)
    id2 = _create_request(client, user_headers, start_time="09:00", end_time="11:00", duration=2)

    # Assign both the same lot_id
    for req_id in (id1, id2):
        req = db_session.query(models.ParkingRequest).filter(models.ParkingRequest.id == req_id).first()
        req.lot_id = "F1-001"
    db_session.commit()

    run_auto_approval(db=db_session)

    approved = client.get("/api/requests/approved", headers=user_headers).json()
    pending  = client.get("/api/requests/pending",  headers=user_headers).json()

    approved_ids = [r["id"] for r in approved]
    pending_ids  = [r["id"] for r in pending]

    # Oldest (id1) approved; newest (id2) still pending
    assert id1 in approved_ids
    assert id2 in pending_ids
    # Sanity: id1 was auto-approved
    req1 = next(r for r in approved if r["id"] == id1)
    assert req1["approved_by"] == "auto"


def test_auto_approve_idempotent_on_approved_requests(client, db_session, user_headers):
    """Running the scheduler twice does not double-process already-approved requests."""
    req_id = _create_request(client, user_headers)

    run_auto_approval(db=db_session)
    run_auto_approval(db=db_session)  # second run — should be a no-op

    resp = client.get("/api/requests/approved", headers=user_headers)
    ids = [r["id"] for r in resp.json()]
    assert ids.count(req_id) == 1  # approved exactly once
