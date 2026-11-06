"""Tests for /api/requests/* endpoints."""

from .conftest import REQUEST_PAYLOAD, create_lot_owned_by, future_date


# ── GET /api/requests ──────────────────────────────────────────────────────

def test_get_all_requests_empty_initially(client, manager_headers):
    resp = client.get("/api/requests", headers=manager_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_all_requests_requires_auth(client):
    resp = client.get("/api/requests")
    assert resp.status_code == 401


def test_get_all_requests_requires_manager_role(client, user_headers):
    resp = client.get("/api/requests", headers=user_headers)
    assert resp.status_code == 403


def test_get_all_requests_includes_created_request(client, manager_headers, created_request_id):
    resp = client.get("/api/requests", headers=manager_headers)
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


def test_approve_request_assigns_lot_fields(client, user_headers, owner_headers, manager_headers, created_request_id):
    create_lot_owned_by(client, manager_headers, owner_headers, "F1-001")
    owner_name = client.get("/auth/me", headers=owner_headers).json()["name"]
    resp = client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={"lot_id": "F1-001", "floor": "F1 - Ground Floor", "lot_owner": owner_name},
        headers=owner_headers,
    )
    data = resp.json()
    assert data["lot_id"] == "F1-001"
    assert data["floor"] == "F1 - Ground Floor"
    assert data["lot_owner"] == owner_name


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


def test_approve_nonexistent_lot_returns_404(client, owner_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={"lot_id": "NONEXISTENT-LOT"},
        headers=owner_headers,
    )
    assert resp.status_code == 404


def test_owner_cannot_approve_with_another_owners_lot(client, user_headers, owner_headers, manager_headers, created_request_id):
    """M-6: Owner must not approve a request by assigning a lot they don't own."""
    # Create a lot owned by a different user (manager creates it, assigned to themselves for the test)
    manager_me = client.get("/auth/me", headers=manager_headers).json()
    client.post("/api/lots", json={
        "id": "F8-001", "floor": "F8", "floor_label": "F8 - Test",
        "owner": manager_me["name"], "owner_id": manager_me["id"], "status": "available",
    }, headers=manager_headers)

    # Owner (Bob) tries to approve using a lot owned by the manager — should be 403
    resp = client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={"lot_id": "F8-001", "floor": "F8", "lot_owner": manager_me["name"]},
        headers=owner_headers,
    )
    assert resp.status_code == 403
    assert "own" in resp.json()["detail"].lower()


def test_manager_can_approve_with_any_lot(client, user_headers, manager_headers, created_request_id):
    """Manager bypass: managers may assign any lot regardless of ownership."""
    manager_me = client.get("/auth/me", headers=manager_headers).json()
    client.post("/api/lots", json={
        "id": "F8-002", "floor": "F8", "floor_label": "F8 - Test",
        "owner": manager_me["name"], "owner_id": manager_me["id"], "status": "available",
    }, headers=manager_headers)

    resp = client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={"lot_id": "F8-002", "floor": "F8", "lot_owner": manager_me["name"]},
        headers=manager_headers,
    )
    assert resp.status_code == 200


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
        json={"date": future_date(14), "start_time": "10:00", "end_time": "12:00", "duration": 2},
        headers=user_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["date"] == future_date(14)


def test_update_only_sends_changed_fields(client, user_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}",
        json={"date": future_date(21)},
        headers=user_headers,
    )
    data = resp.json()
    assert data["date"] == future_date(21)
    assert data["start_time"] == REQUEST_PAYLOAD["start_time"]  # unchanged


def test_update_another_users_request_returns_403(client, owner_headers, created_request_id):
    resp = client.patch(
        f"/api/requests/{created_request_id}",
        json={"date": future_date(28)},
        headers=owner_headers,
    )
    assert resp.status_code == 403


def test_update_approved_request_returns_400(client, user_headers, owner_headers, created_request_id):
    client.patch(f"/api/requests/{created_request_id}/approve", json={}, headers=owner_headers)
    resp = client.patch(
        f"/api/requests/{created_request_id}",
        json={"date": future_date(35)},
        headers=user_headers,
    )
    assert resp.status_code == 400
    assert "pending" in resp.json()["detail"].lower()


def test_update_nonexistent_returns_404(client, user_headers):
    resp = client.patch(
        "/api/requests/REQ-999",
        json={"date": future_date(42)},
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


def test_create_request_rejects_outside_36h(client, user_headers):
    # 40h request should fail
    bad = {**REQUEST_PAYLOAD, "start_time": "10:00", "duration": 40}
    bad.pop("end_date", None)
    bad.pop("end_time", None)
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422
    assert "36" in resp.text.lower()


def test_create_request_rejects_start_equals_end(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "10:00", "end_time": "10:00", "duration": 0}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422


def test_create_request_success_36h_across_midnight(client, user_headers):
    # 30h request starting at 20:00 should end at 02:00 two days later (30h = day1(4h) + day2(24h) + day3(2h))
    payload = {**REQUEST_PAYLOAD, "start_time": "20:00", "duration": 30}
    payload.pop("end_date", None)
    payload.pop("end_time", None)
    resp = client.post("/api/requests", json=payload, headers=user_headers)
    if resp.status_code != 201:
        print(f"DEBUG FAIL: {resp.status_code} {resp.json()}")
    assert resp.status_code == 201
    data = resp.json()
    assert data["duration"] == 30
    assert data["end_time"] == "02:00"
    assert data["end_date"] != data["date"]


def test_create_request_rejects_wrong_duration(client, user_headers):
    bad = {**REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 5}
    resp = client.post("/api/requests", json=bad, headers=user_headers)
    assert resp.status_code == 422
    assert "duration" in resp.text.lower()


# ── Time conflict detection (PATCH /api/requests/{id}/approve) ────────────

def test_approve_detects_time_slot_conflict(client, user_headers, owner_headers, manager_headers):
    """Approving two requests for the same lot/date with overlapping times → 409."""
    create_lot_owned_by(client, manager_headers, owner_headers, "F1-001")
    owner_name = client.get("/auth/me", headers=owner_headers).json()["name"]

    r1 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    r2 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "10:00", "end_time": "12:00", "duration": 2,
    }, headers=user_headers)
    assert r1.status_code == 201
    assert r2.status_code == 201
    id1, id2 = r1.json()["id"], r2.json()["id"]

    lot_info = {"lot_id": "F1-001", "floor": "F1", "lot_owner": owner_name}

    # Approve first request — should succeed
    resp1 = client.patch(f"/api/requests/{id1}/approve", json=lot_info, headers=owner_headers)
    assert resp1.status_code == 200

    # Approve second request for same lot and overlapping time — should conflict
    resp2 = client.patch(f"/api/requests/{id2}/approve", json=lot_info, headers=owner_headers)
    assert resp2.status_code == 409
    assert "conflict" in resp2.json()["detail"].lower()


def test_approve_no_conflict_different_lot(client, user_headers, owner_headers, manager_headers):
    """Same time slot on different lots is allowed."""
    create_lot_owned_by(client, manager_headers, owner_headers, "F1-001")
    create_lot_owned_by(client, manager_headers, owner_headers, "F1-002")
    owner_name = client.get("/auth/me", headers=owner_headers).json()["name"]

    r1 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    r2 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    id1, id2 = r1.json()["id"], r2.json()["id"]

    client.patch(f"/api/requests/{id1}/approve",
                 json={"lot_id": "F1-001", "floor": "F1", "lot_owner": owner_name},
                 headers=owner_headers)
    resp2 = client.patch(f"/api/requests/{id2}/approve",
                         json={"lot_id": "F1-002", "floor": "F1", "lot_owner": owner_name},
                         headers=owner_headers)
    assert resp2.status_code == 200


def test_approve_no_conflict_adjacent_slots(client, user_headers, owner_headers, manager_headers):
    """Adjacent (non-overlapping) slots on the same lot are allowed."""
    create_lot_owned_by(client, manager_headers, owner_headers, "F1-001")
    owner_name = client.get("/auth/me", headers=owner_headers).json()["name"]

    r1 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "09:00", "end_time": "11:00", "duration": 2,
    }, headers=user_headers)
    r2 = client.post("/api/requests", json={
        **REQUEST_PAYLOAD, "start_time": "11:00", "end_time": "13:00", "duration": 2,
    }, headers=user_headers)
    id1, id2 = r1.json()["id"], r2.json()["id"]

    lot_info = {"lot_id": "F1-001", "floor": "F1", "lot_owner": owner_name}
    client.patch(f"/api/requests/{id1}/approve", json=lot_info, headers=owner_headers)
    resp2 = client.patch(f"/api/requests/{id2}/approve", json=lot_info, headers=owner_headers)
    assert resp2.status_code == 200



# ── Request id generation ──────────────────────────────────────────────────

def _insert_request_row(db_session, request_id: str) -> None:
    import models
    db_session.add(models.ParkingRequest(
        id=request_id, requester_id="u-1", requester_name="Seed", date="2030-01-01",
        start_time="09:00", end_date="2030-01-01", end_time="10:00", duration=1,
        submitted_at="2030-01-01T00:00:00+00:00",
    ))
    db_session.commit()


def test_generate_id_starts_at_req_001(db_session):
    from routers.requests import _generate_id
    assert _generate_id(db_session) == "REQ-001"


def test_generate_id_increments_past_999(db_session):
    """Regression: string ordering put REQ-999 above REQ-1000, so ids collided after 999."""
    from routers.requests import _generate_id
    _insert_request_row(db_session, "REQ-998")
    _insert_request_row(db_session, "REQ-999")
    assert _generate_id(db_session) == "REQ-1000"

    _insert_request_row(db_session, "REQ-1000")
    assert _generate_id(db_session) == "REQ-1001"


def test_generate_id_ignores_non_numeric_ids(db_session):
    from routers.requests import _generate_id
    _insert_request_row(db_session, "REQ-007")
    _insert_request_row(db_session, "REQ-ABC123")
    assert _generate_id(db_session) == "REQ-008"


# ── GET /api/requests/availability-check ───────────────────────────────────

def _check(client, headers, day, start="09:00", end="11:00"):
    return client.get(
        "/api/requests/availability-check",
        params={"date": day, "start_time": start, "end_date": day, "end_time": end},
        headers=headers,
    )


def test_availability_check_requires_auth(client):
    resp = client.get(
        "/api/requests/availability-check",
        params={"date": future_date(), "start_time": "09:00", "end_date": future_date(), "end_time": "11:00"},
    )
    assert resp.status_code == 401


def test_availability_check_no_lots_means_zero(client, user_headers):
    resp = _check(client, user_headers, future_date())
    assert resp.status_code == 200
    assert resp.json() == {"available_lots": 0, "total_lots": 0}


def test_availability_check_counts_free_lot(client, user_headers, manager_headers, owner_headers):
    create_lot_owned_by(client, manager_headers, owner_headers, "F1-001")
    resp = _check(client, user_headers, future_date())
    assert resp.status_code == 200
    assert resp.json() == {"available_lots": 1, "total_lots": 1}


def test_availability_check_excludes_lot_with_approved_booking(client, user_headers, manager_headers, owner_headers):
    create_lot_owned_by(client, manager_headers, owner_headers, "F1-001")
    created = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert created.status_code == 201, created.text
    rid = created.json()["id"]
    approve = client.patch(f"/api/requests/{rid}/approve", json={"lot_id": "F1-001"}, headers=owner_headers)
    assert approve.status_code == 200, approve.text
    booked = created.json()
    resp = client.get(
        "/api/requests/availability-check",
        params={
            "date": booked["date"], "start_time": booked["start_time"],
            "end_date": booked["end_date"], "end_time": booked["end_time"],
        },
        headers=user_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"available_lots": 0, "total_lots": 1}


def test_availability_check_rejects_bad_input(client, user_headers):
    resp = _check(client, user_headers, future_date(), start="11:00", end="09:00")
    assert resp.status_code == 422
    resp = client.get(
        "/api/requests/availability-check",
        params={"date": "not-a-date", "start_time": "09:00", "end_date": "x", "end_time": "11:00"},
        headers=user_headers,
    )
    assert resp.status_code == 422
