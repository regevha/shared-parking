"""
Input-validation rules enforced by the request, preference and availability-window schemas.

Every rule here is reachable by a client, so each is checked through the API and must answer 422 without
changing any stored data.
"""

import pytest

from .conftest import REQUEST_PAYLOAD


# ── POST /api/requests ──────────────────────────────────────────────────────

def test_create_rejects_impossible_calendar_date(client, user_headers):
    resp = client.post("/api/requests", json={**REQUEST_PAYLOAD, "date": "2030-02-30"}, headers=user_headers)
    assert resp.status_code == 422
    assert "not a valid calendar date" in resp.text


def test_create_rejects_malformed_end_date(client, user_headers):
    payload = {**REQUEST_PAYLOAD, "end_date": "not-a-date", "end_time": "11:00"}
    assert client.post("/api/requests", json=payload, headers=user_headers).status_code == 422


def test_create_accepts_explicit_null_end_fields_and_computes_them(client, user_headers):
    payload = {**REQUEST_PAYLOAD, "end_date": None, "end_time": None}
    resp = client.post("/api/requests", json=payload, headers=user_headers)
    assert resp.status_code == 201
    assert resp.json()["end_time"] == "11:00"  # 09:00 + 2h


# ── PATCH /api/requests/{id} ────────────────────────────────────────────────

@pytest.fixture
def pending_id(client, user_headers):
    resp = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert resp.status_code == 201
    return resp.json()["id"]


def _mine(client, headers, request_id):
    return next(r for r in client.get("/api/requests/me", headers=headers).json() if r["id"] == request_id)


@pytest.mark.parametrize("field,value,message", [
    ("date", "2030/01/01", "YYYY-MM-DD"),
    ("date", "2030-02-30", "not a valid calendar date"),
    ("date", "2000-01-01", "cannot be in the past"),
    ("start_time", "9am", "HH:MM"),
    ("start_time", "25:00", "HH:MM"),
])
def test_patch_rejects_invalid_values(client, user_headers, pending_id, field, value, message):
    resp = client.patch(f"/api/requests/{pending_id}", json={field: value}, headers=user_headers)
    assert resp.status_code == 422
    assert message in resp.text

    unchanged = _mine(client, user_headers, pending_id)
    assert unchanged["date"] == REQUEST_PAYLOAD["date"]
    assert unchanged["start_time"] == "09:00"


def test_patch_null_fields_leave_request_unchanged(client, user_headers, pending_id):
    resp = client.patch(
        f"/api/requests/{pending_id}",
        json={"date": None, "start_time": None, "end_time": None, "duration": 3},
        headers=user_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["date"] == REQUEST_PAYLOAD["date"]
    assert body["start_time"] == "09:00"
    assert body["end_time"] == "12:00"  # duration changed 2h -> 3h


# ── PATCH /api/users/{id}/preferences ───────────────────────────────────────

def _uid(client, headers):
    return client.get("/auth/me", headers=headers).json()["id"]


@pytest.mark.parametrize("language", ["de", "EN", "", "english"])
def test_preferences_reject_unsupported_language(client, user_headers, language):
    uid = _uid(client, user_headers)
    resp = client.patch(f"/api/users/{uid}/preferences", json={"language": language}, headers=user_headers)
    assert resp.status_code == 422
    assert client.get(f"/api/users/{uid}/preferences", headers=user_headers).json()["language"] == "en"


@pytest.mark.parametrize("language", ["en", "fr", "he"])
def test_preferences_accept_each_supported_language(client, user_headers, language):
    uid = _uid(client, user_headers)
    resp = client.patch(f"/api/users/{uid}/preferences", json={"language": language}, headers=user_headers)
    assert resp.status_code == 200
    assert client.get(f"/api/users/{uid}/preferences", headers=user_headers).json()["language"] == language


# ── Availability windows ────────────────────────────────────────────────────

@pytest.mark.parametrize("payload,message", [
    ({"day_of_week": 0, "start_time": "8am", "end_time": "18:00"}, "HH:MM"),
    ({"day_of_week": 0, "start_time": "08:00", "end_time": "24:61"}, "HH:MM"),
    ({"day_of_week": 7, "start_time": "08:00", "end_time": "18:00"}, "day_of_week"),
    ({"day_of_week": -1, "start_time": "08:00", "end_time": "18:00"}, "day_of_week"),
    ({"specific_date": "2030/01/01", "start_time": "08:00", "end_time": "18:00"}, "specific_date"),
    ({"start_time": "08:00", "end_time": "18:00"}, "either day_of_week or specific_date"),
    ({"day_of_week": 0, "specific_date": "2030-01-01", "start_time": "08:00", "end_time": "18:00"}, "only one"),
    ({"day_of_week": 0, "start_time": "18:00", "end_time": "08:00"}, "after start_time"),
])
def test_create_window_rejects_invalid_payload(client, owner_headers, owner_lot_id, payload, message):
    resp = client.post(f"/api/lots/{owner_lot_id}/availability", json=payload, headers=owner_headers)
    assert resp.status_code == 422
    assert message in resp.text
    assert client.get(f"/api/lots/{owner_lot_id}/availability", headers=owner_headers).json() == []


def test_update_window_rejects_bad_time(client, owner_headers, owner_lot_id):
    created = client.post(
        f"/api/lots/{owner_lot_id}/availability",
        json={"day_of_week": 0, "start_time": "08:00", "end_time": "18:00"},
        headers=owner_headers,
    )
    assert created.status_code == 201
    win_id = created.json()["id"]

    resp = client.patch(f"/api/lots/{owner_lot_id}/availability/{win_id}", json={"start_time": "noon"}, headers=owner_headers)
    assert resp.status_code == 422
    assert client.get(f"/api/lots/{owner_lot_id}/availability", headers=owner_headers).json()[0]["start_time"] == "08:00"
