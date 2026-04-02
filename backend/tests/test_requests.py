"""Tests for /api/requests/* endpoints."""

import pytest
from .conftest import REQUEST_PAYLOAD


# ── GET /api/requests ──────────────────────────────────────────────────────

def test_get_all_requests_empty_initially(client, user_headers):
    resp = client.get("/api/requests", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_all_requests_requires_auth(client):
    resp = client.get("/api/requests")
    assert resp.status_code == 401


def test_get_all_requests_includes_created_request(client, user_headers, created_request_id):
    resp = client.get("/api/requests", headers=user_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert created_request_id in ids


# ── GET /api/requests/pending ─────────────────────────────────────────────

def test_get_pending_returns_pending_requests(client, user_headers, created_request_id):
    resp = client.get("/api/requests/pending", headers=user_headers)
    assert resp.status_code == 200
    assert any(r["id"] == created_request_id for r in resp.json())


def test_get_pending_excludes_approved(client, user_headers, owner_headers, created_request_id):
    client.patch(f"/api/requests/{created_request_id}/approve", json={}, headers=owner_headers)
    resp = client.get("/api/requests/pending", headers=user_headers)
    ids = [r["id"] for r in resp.json()]
    assert created_request_id not in ids


# ── GET /api/requests/approved ────────────────────────────────────────────

def test_get_approved_includes_approved_request(client, user_headers, owner_headers, created_request_id):
    client.patch(f"/api/requests/{created_request_id}/approve", json={}, headers=owner_headers)
    resp = client.get("/api/requests/approved", headers=user_headers)
    assert any(r["id"] == created_request_id for r in resp.json())


def test_get_approved_excludes_pending(client, user_headers, created_request_id):
    resp = client.get("/api/requests/approved", headers=user_headers)
    ids = [r["id"] for r in resp.json()]
    assert created_request_id not in ids


# ── GET /api/requests/me ──────────────────────────────────────────────────

def test_get_my_requests_returns_only_own(client, user_headers, owner_headers, created_request_id):
    # owner has submitted nothing
    resp = client.get("/api/requests/me", headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_my_requests_includes_own_request(client, user_headers, created_request_id):
    resp = client.get("/api/requests/me", headers=user_headers)
    assert any(r["id"] == created_request_id for r in resp.json())


# ── POST /api/requests ────────────────────────────────────────────────────

def test_create_request_success(client, user_headers):
    resp = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["id"].startswith("REQ-")
    assert data["date"] == REQUEST_PAYLOAD["date"]
    # requester fields come from JWT, not payload
    assert data["requester_name"] == "Alice User"


def test_create_request_requires_auth(client):
    resp = client.post("/api/requests", json=REQUEST_PAYLOAD)
    assert resp.status_code == 401


def test_create_request_missing_required_field_returns_422(client, user_headers):
    bad = {k: v for k, v in REQUEST_PAYLOAD.items() if k != "date"}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422


# ── PATCH /api/requests/{id}/approve ─────────────────────────────────────

def test_approve_request_success_as_owner(client, user_headers, owner_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["approved_at"] is not None


def test_approve_request_assigns_lot_fields(client, user_headers, owner_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={"lot_id": "F1-001", "floor": "F1 - Ground Floor", "lot_owner": "Bob Owner"},
        headers=owner_headers,
    )
    data = resp.json()
    assert data["lot_id"] == "F1-001"
    assert data["floor"] == "F1 - Ground Floor"
    assert data["lot_owner"] == "Bob Owner"


def test_approve_request_requires_owner_role(client, user_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={},
        headers=user_headers,
    )
    assert resp.status_code == 403


def test_approve_request_requires_auth(client, created_request_id):
    resp = client.patch(f"/api/requests/{created_request_id}/approve", json={})
    assert resp.status_code == 401


def test_approve_already_approved_returns_400(client, user_headers, owner_headers, created_request_id):
    client.patch(f"/api/requests/{created_request_id}/approve", json={}, headers=owner_headers)
    resp = client.patch(f"/api/requests/{created_request_id}/approve", json={}, headers=owner_headers)
    assert resp.status_code == 400
    assert "pending" in resp.json()["detail"].lower()


def test_approve_nonexistent_request_returns_404(client, owner_headers):
    resp = client.patch("/api/requests/REQ-999/approve", json={}, headers=owner_headers)
    assert resp.status_code == 404


# ── PATCH /api/requests/{id}/reject ──────────────────────────────────────

def test_reject_request_success_as_owner(client, owner_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}/reject",
        headers=owner_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["rejected_by_owner"] is True


def test_reject_requires_owner_role(client, user_headers, created_request_id):
    resp = client.patch(f"/api/requests/{created_request_id}/reject", headers=user_headers)
    assert resp.status_code == 403


def test_reject_nonexistent_returns_404(client, owner_headers):
    resp = client.patch("/api/requests/REQ-999/reject", headers=owner_headers)
    assert resp.status_code == 404


# ── PATCH /api/requests/{id} (update fields) ─────────────────────────────

def test_update_own_pending_request(client, user_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}",
        json={"date": "2026-05-01", "start_time": "10:00", "end_time": "12:00", "duration": 2},
        headers=user_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["date"] == "2026-05-01"


def test_update_only_sends_changed_fields(client, user_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}",
        json={"date": "2026-06-15"},
        headers=user_headers,
    )
    data = resp.json()
    assert data["date"] == "2026-06-15"
    assert data["start_time"] == REQUEST_PAYLOAD["start_time"]  # unchanged


def test_update_another_users_request_returns_403(client, owner_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}",
        json={"date": "2026-07-01"},
        headers=owner_headers,
    )
    assert resp.status_code == 403


def test_update_approved_request_returns_400(client, user_headers, owner_headers, created_request_id):
    client.patch(f"/api/requests/{created_request_id}/approve", json={}, headers=owner_headers)
    resp = client.patch(
        f"/api/requests/{created_request_id}",
        json={"date": "2026-08-01"},
        headers=user_headers,
    )
    assert resp.status_code == 400
    assert "pending" in resp.json()["detail"].lower()


def test_update_nonexistent_returns_404(client, user_headers):
    resp = client.patch(
        "/api/requests/REQ-999",
        json={"date": "2026-09-01"},
        headers=user_headers,
    )
    assert resp.status_code == 404


# ── DELETE /api/requests/{id} ─────────────────────────────────────────────

def test_delete_own_request_returns_204(client, user_headers, created_request_id):
    resp = client.delete(f"/api/requests/{created_request_id}", headers=user_headers)
    assert resp.status_code == 204
    # Verify it's gone
    my_resp = client.get("/api/requests/me", headers=user_headers)
    ids = [r["id"] for r in my_resp.json()]
    assert created_request_id not in ids


def test_delete_another_users_request_returns_403(client, owner_headers, created_request_id):
    resp = client.delete(f"/api/requests/{created_request_id}", headers=owner_headers)
    assert resp.status_code == 403


def test_delete_nonexistent_returns_404(client, user_headers):
    resp = client.delete("/api/requests/REQ-999", headers=user_headers)
    assert resp.status_code == 404


def test_delete_requires_auth(client, created_request_id):
    resp = client.delete(f"/api/requests/{created_request_id}")
    assert resp.status_code == 401


# ── Input validation (POST /api/requests) ────────────────────────────────

def test_create_request_rejects_past_date(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "date": "2020-01-01"}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422
    assert "past" in resp.text.lower()


def test_create_request_rejects_invalid_date_format(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "date": "01-04-2026"}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422


def test_create_request_rejects_invalid_time_format(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "9:00"}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422


def test_create_request_rejects_start_after_end(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "14:00", "end_time": "10:00", "duration": 2}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422
    assert "before" in resp.text.lower()


def test_create_request_rejects_start_equals_end(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "10:00", "end_time": "10:00", "duration": 0}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422


def test_create_request_rejects_end_time_after_20(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "19:00", "end_time": "21:00", "duration": 2}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422
    assert "20:00" in resp.text


def test_create_request_rejects_start_before_07(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "06:00", "end_time": "08:00", "duration": 2}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422
    assert "07:00" in resp.text


def test_create_request_rejects_wrong_duration(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 5}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422
    assert "duration" in resp.text.lower()


# ── Time conflict detection (PATCH /api/requests/{id}/approve) ────────────

def test_approve_detects_time_slot_conflict(client, user_headers, owner_headers):
    """Approving two requests for the same lot/date with overlapping times → 409."""
    # Create two requests for the same date and overlapping slot
    r1 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    r2 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "10:00", "end_time": "12:00", "duration": 2,
    }, headers=user_headers)
    assert r1.status_code == 201
    assert r2.status_code == 201
    id1, id2 = r1.json()["id"], r2.json()["id"]

    lot_info = {"lot_id": "F1-001", "floor": "F1", "lot_owner": "Bob"}

    # Approve first request — should succeed
    resp1 = client.patch(f"/api/requests/{id1}/approve", json=lot_info, headers=owner_headers)
    assert resp1.status_code == 200

    # Approve second request for same lot and overlapping time — should conflict
    resp2 = client.patch(f"/api/requests/{id2}/approve", json=lot_info, headers=owner_headers)
    assert resp2.status_code == 409
    assert "conflict" in resp2.json()["detail"].lower()


def test_approve_no_conflict_different_lot(client, user_headers, owner_headers):
    """Same time slot on different lots is allowed."""
    r1 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    r2 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    id1, id2 = r1.json()["id"], r2.json()["id"]

    client.patch(f"/api/requests/{id1}/approve",
                 json={"lot_id": "F1-001", "floor": "F1", "lot_owner": "Bob"},
                 headers=owner_headers)
    resp2 = client.patch(f"/api/requests/{id2}/approve",
                         json={"lot_id": "F1-002", "floor": "F1", "lot_owner": "Bob"},
                         headers=owner_headers)
    assert resp2.status_code == 200


def test_approve_no_conflict_adjacent_slots(client, user_headers, owner_headers):
    """Adjacent (non-overlapping) slots on the same lot are allowed."""
    r1 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    r2 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "11:00", "end_time": "13:00", "duration": 2,
    }, headers=user_headers)
    id1, id2 = r1.json()["id"], r2.json()["id"]

    lot_info = {"lot_id": "F1-001", "floor": "F1", "lot_owner": "Bob"}
    client.patch(f"/api/requests/{id1}/approve", json=lot_info, headers=owner_headers)
    resp2 = client.patch(f"/api/requests/{id2}/approve", json=lot_info, headers=owner_headers)
    assert resp2.status_code == 200
