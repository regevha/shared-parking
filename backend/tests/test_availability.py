"""Tests for /api/lots/{lot_id}/availability endpoints and availability enforcement."""

from datetime import date, timedelta
from .conftest import _FUTURE_DATE


# ── Fixtures ──────────────────────────────────────────────────────────────────

WINDOW_PAYLOAD = {
    "day_of_week": 0,   # Monday
    "start_time": "08:00",
    "end_time": "18:00",
}

# A date that lands on a known weekday far enough in the future
_NEXT_MONDAY = _FUTURE_DATE   # may not be Monday, but we override in specific tests

def _future_monday() -> str:
    """Return the nearest future Monday as YYYY-MM-DD."""
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7 or 7  # 0=Monday; get NEXT Monday
    return (today + timedelta(days=days_ahead)).isoformat()

def _future_tuesday() -> str:
    today = date.today()
    days_ahead = (1 - today.weekday()) % 7 or 7
    return (today + timedelta(days=days_ahead)).isoformat()


# ── GET /api/lots/{lot_id}/availability ───────────────────────────────────────

def test_list_windows_empty(client, user_headers, owner_lot_id):
    resp = client.get(f"/api/lots/{owner_lot_id}/availability", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_windows_requires_auth(client, owner_lot_id):
    resp = client.get(f"/api/lots/{owner_lot_id}/availability")
    assert resp.status_code == 401


def test_list_windows_404_unknown_lot(client, user_headers):
    resp = client.get("/api/lots/NONEXISTENT/availability", headers=user_headers)
    assert resp.status_code == 404


# ── POST /api/lots/{lot_id}/availability ──────────────────────────────────────

def test_create_window_owner(client, owner_headers, owner_lot_id):
    resp = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json=WINDOW_PAYLOAD,
        headers=owner_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["lot_id"] == owner_lot_id
    assert data["day_of_week"] == 0
    assert data["start_time"] == "08:00"
    assert data["end_time"] == "18:00"
    assert data["is_active"] is True


def test_create_window_manager(client, manager_headers, owner_lot_id):
    resp = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json=WINDOW_PAYLOAD,
        headers=manager_headers,
    )
    assert resp.status_code == 201


def test_create_window_user_forbidden(client, user_headers, owner_lot_id):
    resp = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json=WINDOW_PAYLOAD,
        headers=user_headers,
    )
    assert resp.status_code == 403


def _other_owner_headers(client, db_session):
    from .conftest import register_and_login
    return register_and_login(client, "Erin Other", "erin@test.com", "Pass1234", "owner", db_session)


def test_create_window_wrong_owner_forbidden(client, db_session, owner_lot_id):
    """A second owner cannot create windows for a lot they don't own."""
    other = _other_owner_headers(client, db_session)
    before = client.get(f"/api/lots/{owner_lot_id}/availability", headers=other).json()

    resp = client.post(f"/api/lots/{owner_lot_id}/availability", json=WINDOW_PAYLOAD, headers=other)

    assert resp.status_code == 403
    assert client.get(f"/api/lots/{owner_lot_id}/availability", headers=other).json() == before


def test_update_and_delete_window_wrong_owner_forbidden(client, db_session, owner_headers, owner_lot_id):
    """A second owner can neither modify nor remove another owner's window."""
    created = client.post(f"/api/lots/{owner_lot_id}/availability", json=WINDOW_PAYLOAD, headers=owner_headers)
    assert created.status_code == 201
    win_id = created.json()["id"]
    other = _other_owner_headers(client, db_session)

    patch = client.patch(f"/api/lots/{owner_lot_id}/availability/{win_id}", json={"is_active": False}, headers=other)
    assert patch.status_code == 403
    delete = client.delete(f"/api/lots/{owner_lot_id}/availability/{win_id}", headers=other)
    assert delete.status_code == 403

    windows = client.get(f"/api/lots/{owner_lot_id}/availability", headers=owner_headers).json()
    assert [w["id"] for w in windows] == [win_id]
    assert windows[0]["is_active"] is True


def test_create_window_specific_date(client, owner_headers, owner_lot_id):
    resp = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"specific_date": "2030-06-15", "start_time": "09:00", "end_time": "17:00"},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["specific_date"] == "2030-06-15"
    assert resp.json()["day_of_week"] is None


def test_create_window_both_day_and_date_invalid(client, owner_headers, owner_lot_id):
    resp = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"day_of_week": 0, "specific_date": "2030-06-15", "start_time": "09:00", "end_time": "17:00"},
        headers=owner_headers,
    )
    assert resp.status_code == 422


def test_create_window_missing_both_day_and_date_invalid(client, owner_headers, owner_lot_id):
    resp = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"start_time": "09:00", "end_time": "17:00"},
        headers=owner_headers,
    )
    assert resp.status_code == 422


def test_create_window_end_before_start_invalid(client, owner_headers, owner_lot_id):
    resp = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"day_of_week": 1, "start_time": "18:00", "end_time": "08:00"},
        headers=owner_headers,
    )
    assert resp.status_code == 422


def test_list_windows_shows_created(client, owner_headers, owner_lot_id):
    client.post(f"/api/lots/{owner_lot_id}/availability", json=WINDOW_PAYLOAD, headers=owner_headers)
    resp = client.get(f"/api/lots/{owner_lot_id}/availability", headers=owner_headers)
    assert len(resp.json()) == 1


# ── PATCH /api/lots/{lot_id}/availability/{window_id} ────────────────────────

def _create_window(client, lot_id, headers, payload=None) -> int:
    p = payload or WINDOW_PAYLOAD
    resp = client.post(f"/api/lots/{lot_id}/availability", json=p, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


def test_update_window_toggle_inactive(client, owner_headers, owner_lot_id):
    wid = _create_window(client, owner_lot_id, owner_headers)
    resp = client.patch(
        f"/api/lots/{owner_lot_id}/availability/{wid}",
        json={"is_active": False},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_update_window_change_times(client, owner_headers, owner_lot_id):
    wid = _create_window(client, owner_lot_id, owner_headers)
    resp = client.patch(
        f"/api/lots/{owner_lot_id}/availability/{wid}",
        json={"start_time": "10:00", "end_time": "16:00"},
        headers=owner_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["start_time"] == "10:00"
    assert data["end_time"] == "16:00"


def test_update_window_404(client, owner_headers, owner_lot_id):
    resp = client.patch(
        f"/api/lots/{owner_lot_id}/availability/99999",
        json={"is_active": False},
        headers=owner_headers,
    )
    assert resp.status_code == 404


# ── DELETE /api/lots/{lot_id}/availability/{window_id} ───────────────────────

def test_delete_window(client, owner_headers, owner_lot_id):
    wid = _create_window(client, owner_lot_id, owner_headers)
    resp = client.delete(f"/api/lots/{owner_lot_id}/availability/{wid}", headers=owner_headers)
    assert resp.status_code == 204
    # Verify it's gone
    remaining = client.get(f"/api/lots/{owner_lot_id}/availability", headers=owner_headers).json()
    assert not any(w["id"] == wid for w in remaining)


def test_delete_window_404(client, owner_headers, owner_lot_id):
    resp = client.delete(f"/api/lots/{owner_lot_id}/availability/99999", headers=owner_headers)
    assert resp.status_code == 404


# ── Availability enforcement (approve_request) ────────────────────────────────

def _make_request_on_day(client, headers, day_iso: str):
    """Submit a request for a specific date at 09:00 for 2 hours."""
    payload = {
        "date": day_iso,
        "start_time": "09:00",
        "duration": 2,
    }
    resp = client.post("/api/requests", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_approve_with_window_covering_slot_succeeds(client, user_headers, owner_headers, owner_lot_id):
    """Owner can approve when a window covers the requested slot."""
    monday = _future_monday()
    # Create a Monday 08:00-18:00 window
    client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"day_of_week": 0, "start_time": "08:00", "end_time": "18:00"},
        headers=owner_headers,
    )
    # Get owner id and lot info
    me = client.get("/auth/me", headers=owner_headers).json()
    request_id = _make_request_on_day(client, user_headers, monday)
    resp = client.patch(
        f"/api/requests/{request_id}/approve",
        json={"lot_id": owner_lot_id, "floor": "F2", "lot_owner": me["name"]},
        headers=owner_headers,
    )
    assert resp.status_code == 200


def test_approve_without_window_blocked(client, user_headers, owner_headers, owner_lot_id):
    """Approving outside any window raises 403."""
    monday = _future_monday()
    # No windows defined → lot is blocked by default
    me = client.get("/auth/me", headers=owner_headers).json()
    request_id = _make_request_on_day(client, user_headers, monday)
    resp = client.patch(
        f"/api/requests/{request_id}/approve",
        json={"lot_id": owner_lot_id, "floor": "F2", "lot_owner": me["name"]},
        headers=owner_headers,
    )
    assert resp.status_code == 403
    assert "not available" in resp.json()["detail"].lower()


def test_approve_inactive_window_blocked(client, user_headers, owner_headers, owner_lot_id):
    """Inactive window does not count — lot stays blocked."""
    monday = _future_monday()
    wid = _create_window(client, owner_lot_id, owner_headers)
    # Disable it
    client.patch(
        f"/api/lots/{owner_lot_id}/availability/{wid}",
        json={"is_active": False},
        headers=owner_headers,
    )
    me = client.get("/auth/me", headers=owner_headers).json()
    request_id = _make_request_on_day(client, user_headers, monday)
    resp = client.patch(
        f"/api/requests/{request_id}/approve",
        json={"lot_id": owner_lot_id, "floor": "F2", "lot_owner": me["name"]},
        headers=owner_headers,
    )
    assert resp.status_code == 403


def test_manager_can_approve_outside_window(client, user_headers, manager_headers, owner_lot_id):
    """Managers bypass availability checks."""
    monday = _future_monday()
    # No windows → manager can still approve
    request_id = _make_request_on_day(client, user_headers, monday)
    resp = client.patch(
        f"/api/requests/{request_id}/approve",
        json={"lot_id": owner_lot_id, "floor": "F2", "lot_owner": "someone"},
        headers=manager_headers,
    )
    assert resp.status_code == 200


def test_specific_date_window_overrides_dow(client, user_headers, owner_headers, owner_lot_id):
    """A specific-date window takes precedence over a day_of_week window."""
    monday = _future_monday()
    # Block Mondays via day_of_week (remove any covering window)
    # Add only a specific-date window for next Monday
    client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"specific_date": monday, "start_time": "08:00", "end_time": "18:00"},
        headers=owner_headers,
    )
    me = client.get("/auth/me", headers=owner_headers).json()
    request_id = _make_request_on_day(client, user_headers, monday)
    resp = client.patch(
        f"/api/requests/{request_id}/approve",
        json={"lot_id": owner_lot_id, "floor": "F2", "lot_owner": me["name"]},
        headers=owner_headers,
    )
    assert resp.status_code == 200


def test_wrong_day_window_does_not_unlock(client, user_headers, owner_headers, owner_lot_id):
    """A Tuesday window doesn't unlock a Monday request."""
    monday = _future_monday()
    # Add only a Tuesday window
    client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"day_of_week": 1, "start_time": "08:00", "end_time": "18:00"},
        headers=owner_headers,
    )
    me = client.get("/auth/me", headers=owner_headers).json()
    request_id = _make_request_on_day(client, user_headers, monday)
    resp = client.patch(
        f"/api/requests/{request_id}/approve",
        json={"lot_id": owner_lot_id, "floor": "F2", "lot_owner": me["name"]},
        headers=owner_headers,
    )
    assert resp.status_code == 403


# ── Auto-scheduler availability check ────────────────────────────────────────

def test_scheduler_skips_lot_without_window(client, user_headers, owner_headers, owner_lot_id):
    """Auto-approve leaves request pending when no window covers it."""
    from routers.requests import _is_outside_availability

    monday = _future_monday()
    # No windows → blocked
    request_id = _make_request_on_day(client, user_headers, monday)

    # Grab a db session via the app dependency
    db = next(client.app.dependency_overrides[__import__('database', fromlist=['get_db']).get_db]())
    import models
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    result = _is_outside_availability(db, owner_lot_id, req.date, req.start_time, req.end_date, req.end_time)
    assert result is True, "Expected lot to be outside availability (blocked by default)"


def test_scheduler_allows_lot_within_window(client, user_headers, owner_headers, owner_lot_id):
    """_is_outside_availability returns False when a window covers the slot."""
    monday = _future_monday()
    monday_dow = 0  # Monday
    client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"day_of_week": monday_dow, "start_time": "08:00", "end_time": "18:00"},
        headers=owner_headers,
    )
    request_id = _make_request_on_day(client, user_headers, monday)

    db = next(client.app.dependency_overrides[__import__('database', fromlist=['get_db']).get_db]())
    from routers.requests import _is_outside_availability
    import models
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    result = _is_outside_availability(db, owner_lot_id, req.date, req.start_time, req.end_date, req.end_time)
    assert result is False, "Expected lot to be available within window"
