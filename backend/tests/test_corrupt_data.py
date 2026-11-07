"""
Behaviour when the database already holds a malformed date or time (for example from an old import or a manual
edit). The API validates input, so these rows can only appear by writing to the database directly, which is how
the tests create them.

The contract: availability checks fail closed (the slot counts as unavailable) and editing such a request
answers 400 instead of crashing.
"""

import models
from routers.requests import _is_outside_availability
from .conftest import REQUEST_PAYLOAD


def _corrupt(db_session, request_id: str, **fields) -> None:
    req = db_session.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).one()
    for name, value in fields.items():
        setattr(req, name, value)
    db_session.commit()


def _created_pending(client, headers) -> str:
    resp = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


# ── PATCH /api/requests/{id} ────────────────────────────────────────────────

def test_edit_request_with_corrupt_stored_date_returns_400(client, db_session, user_headers):
    req_id = _created_pending(client, user_headers)
    _corrupt(db_session, req_id, date="not-a-date")

    resp = client.patch(f"/api/requests/{req_id}", json={"duration": 3}, headers=user_headers)

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid date or start time"


def test_edit_request_with_corrupt_stored_start_time_returns_400(client, db_session, user_headers):
    req_id = _created_pending(client, user_headers)
    _corrupt(db_session, req_id, start_time="9 o'clock")

    resp = client.patch(f"/api/requests/{req_id}", json={"duration": 3}, headers=user_headers)

    assert resp.status_code == 400


def test_edit_that_replaces_the_corrupt_value_succeeds(client, db_session, user_headers):
    """The user can repair a bad row by supplying a valid date and time."""
    req_id = _created_pending(client, user_headers)
    _corrupt(db_session, req_id, date="not-a-date")

    resp = client.patch(
        f"/api/requests/{req_id}",
        json={"date": REQUEST_PAYLOAD["date"], "start_time": "10:00"},
        headers=user_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["start_time"] == "10:00"


# ── Availability check ──────────────────────────────────────────────────────

def _lot_with_open_window(client, owner_headers, owner_lot_id) -> str:
    window = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"day_of_week": 0, "start_time": "00:00", "end_time": "23:59"},
        headers=owner_headers,
    )
    assert window.status_code == 201
    return owner_lot_id


def test_availability_check_fails_closed_on_malformed_date(client, db_session, owner_headers, owner_lot_id):
    lot_id = _lot_with_open_window(client, owner_headers, owner_lot_id)

    assert _is_outside_availability(db_session, lot_id, "not-a-date", "09:00", "2030-01-01", "10:00") is True


def test_availability_check_fails_closed_on_malformed_time(client, db_session, owner_headers, owner_lot_id):
    lot_id = _lot_with_open_window(client, owner_headers, owner_lot_id)

    assert _is_outside_availability(db_session, lot_id, "2030-01-07", "nine", "2030-01-07", "10:00") is True


def test_availability_check_accepts_a_valid_slot_inside_the_window(client, db_session, owner_headers, owner_lot_id):
    """Control for the two tests above: the same lot says 'available' for a well-formed Monday slot."""
    lot_id = _lot_with_open_window(client, owner_headers, owner_lot_id)

    assert _is_outside_availability(db_session, lot_id, "2030-01-07", "09:00", "2030-01-07", "10:00") is False


# ── Approval paths must not crash on a malformed row ────────────────────────

def test_owner_approval_of_request_with_corrupt_date_returns_400(
    client, db_session, user_headers, owner_headers, owner_lot_id
):
    req_id = _created_pending(client, user_headers)
    _corrupt(db_session, req_id, date="not-a-date")

    resp = client.patch(f"/api/requests/{req_id}/approve", json={"lot_id": owner_lot_id}, headers=owner_headers)

    assert resp.status_code == 400
    assert "invalid date or time" in resp.json()["detail"].lower()
    still_pending = db_session.query(models.ParkingRequest).filter(models.ParkingRequest.id == req_id).one()
    assert still_pending.status == "pending"


def test_auto_approval_skips_a_corrupt_request_and_still_processes_the_rest(
    client, db_session, user_headers, manager_headers
):
    """One bad row must not stop auto-approval for every request submitted after it."""
    from scheduler import run_auto_approval

    lot = client.post("/api/lots", json={"id": "AUTO-C", "floor": "F1", "floor_label": "Floor 1", "status": "available"}, headers=manager_headers)
    assert lot.status_code == 201
    bad_id = _created_pending(client, user_headers)
    good_id = _created_pending(client, user_headers)
    _corrupt(db_session, bad_id, date="not-a-date")

    run_auto_approval(db=db_session)

    rows = {r.id: r for r in db_session.query(models.ParkingRequest).all()}
    assert rows[bad_id].status == "pending"
    assert rows[good_id].status == "approved"
