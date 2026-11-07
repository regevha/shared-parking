"""
Tests for defensive / error branches that the main suites do not reach: missing preference rows, unknown
lots, audit-trail access rules, a malformed CANCELLATION_WINDOW_HOURS setting, and bad rows in CSV imports.
"""

import io

import models
from .conftest import REQUEST_PAYLOAD, create_lot_owned_by, register_and_login


def _user_id(client, headers) -> str:
    return client.get("/auth/me", headers=headers).json()["id"]


def _delete_preferences(db_session, user_id: str) -> None:
    db_session.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).delete()
    db_session.commit()


# ── Users without a preferences row ────────────────────────────────────────

def test_get_preferences_404_when_row_missing(client, db_session, user_headers, manager_headers):
    uid = _user_id(client, user_headers)
    _delete_preferences(db_session, uid)

    resp = client.get(f"/api/users/{uid}/preferences", headers=manager_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Preferences not found"


def test_patch_preferences_404_when_row_missing(client, db_session, user_headers):
    uid = _user_id(client, user_headers)
    _delete_preferences(db_session, uid)

    resp = client.patch(f"/api/users/{uid}/preferences", json={"dark_mode": False}, headers=user_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Preferences not found"


def test_me_falls_back_to_default_preferences_when_row_missing(client, db_session, user_headers):
    """Accounts created before preferences existed must still be able to log in and load the app."""
    _delete_preferences(db_session, _user_id(client, user_headers))

    resp = client.get("/auth/me", headers=user_headers)
    assert resp.status_code == 200
    prefs = resp.json()["preferences"]
    assert prefs["language"] == "en"
    assert isinstance(prefs["dark_mode"], bool)


# ── Availability on a lot that does not exist ──────────────────────────────

def test_create_window_on_unknown_lot_404(client, manager_headers):
    resp = client.post(
        "/api/lots/NO-SUCH-LOT/availability",
        json={"day_of_week": 0, "start_time": "08:00", "end_time": "18:00"},
        headers=manager_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Lot not found"


def test_update_and_delete_window_on_unknown_lot_404(client, manager_headers):
    assert client.patch("/api/lots/NO-SUCH-LOT/availability/1", json={"is_active": False}, headers=manager_headers).status_code == 404
    assert client.delete("/api/lots/NO-SUCH-LOT/availability/1", headers=manager_headers).status_code == 404


# ── Audit trail access ─────────────────────────────────────────────────────

def test_audit_for_unknown_request_404(client, manager_headers):
    resp = client.get("/api/requests/REQ-DOES-NOT-EXIST/audit", headers=manager_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No audit logs found for this request"


def _approved_request(client, user_headers, owner_headers, manager_headers, lot_id="AUD-1") -> str:
    create_lot_owned_by(client, manager_headers, owner_headers, lot_id)
    created = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert created.status_code == 201
    req_id = created.json()["id"]
    owner_name = client.get("/auth/me", headers=owner_headers).json()["name"]
    # lot_owner is stored on the request as a name (the UI sends it with the approval); the audit check relies on it
    approved = client.patch(
        f"/api/requests/{req_id}/approve", json={"lot_id": lot_id, "lot_owner": owner_name}, headers=owner_headers
    )
    assert approved.status_code == 200, approved.text
    return req_id


def test_audit_of_approved_request_visible_to_its_lot_owner_only(
    client, db_session, user_headers, owner_headers, manager_headers
):
    req_id = _approved_request(client, user_headers, owner_headers, manager_headers)
    other_owner = register_and_login(client, "Erin Other", "erin@test.com", "Pass1234", "owner", db_session)

    # The owner of the assigned lot is an involved party
    assert client.get(f"/api/requests/{req_id}/audit", headers=owner_headers).status_code == 200
    # Another owner is not: owners only get general access while a request is still pending
    assert client.get(f"/api/requests/{req_id}/audit", headers=other_owner).status_code == 403


# ── Malformed CANCELLATION_WINDOW_HOURS ────────────────────────────────────

def test_cancel_approved_request_with_malformed_window_setting(
    client, user_headers, owner_headers, manager_headers, monkeypatch
):
    """A bad env value must not break cancellation: the check is skipped, not turned into a 500."""
    req_id = _approved_request(client, user_headers, owner_headers, manager_headers, "AUD-2")
    monkeypatch.setenv("CANCELLATION_WINDOW_HOURS", "not-a-number")

    assert client.delete(f"/api/requests/{req_id}", headers=user_headers).status_code == 204


# ── Bad rows in CSV imports ────────────────────────────────────────────────

def _csv(content: str):
    return {"file": ("data.csv", io.BytesIO(content.encode()), "text/csv")}


def test_import_users_row_that_fails_to_save_is_reported(client, manager_headers):
    """A row missing its password cell cannot be hashed; it must be reported while the other rows still import."""
    csv = "name,email,role,password\nShort Row,short@test.com,user\nGood Row,good@test.com,user,pass1\n"
    resp = client.post("/api/admin/import-users", files=_csv(csv), headers=manager_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["imported"] == 1
    assert len(body["errors"]) == 1
    emails = [u["email"] for u in client.get("/api/users", headers=manager_headers).json()]
    assert "good@test.com" in emails
    assert "short@test.com" not in emails


def test_import_lots_incomplete_row_is_reported_and_valid_rows_still_import(client, manager_headers):
    """A truncated row (no floor) is reported without stopping the rows around it."""
    csv = "id,floor,floor_label,owner_email\nL-1,1,Floor 1,\nL-2\n"
    resp = client.post("/api/admin/import-lots", files=_csv(csv), headers=manager_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["imported"] == 1
    assert len(body["errors"]) == 1


def test_import_lots_duplicate_id_inside_one_file_is_reported_not_fatal(client, manager_headers):
    """The same lot id twice in one CSV: the second row is reported and the first still imports."""
    csv = "id,floor,floor_label,owner_email\nDUP-1,1,Floor 1,\nDUP-1,1,Floor 1,\nOK-2,2,Floor 2,\n"
    resp = client.post("/api/admin/import-lots", files=_csv(csv), headers=manager_headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported"] == 2
    assert body["errors"] == ["Lot DUP-1 already exists"]
    lot_ids = sorted(lot["id"] for lot in client.get("/api/lots", headers=manager_headers).json())
    assert lot_ids == ["DUP-1", "OK-2"]
