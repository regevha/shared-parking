"""
Tests for the per-user pending-request limit (MAX_PENDING_REQUESTS).

The limit is read from the environment on every request (routers/requests.py), so tests lower it with
monkeypatch instead of creating ten requests each time. One test pins the documented default of 10,
which the frontend mirrors in ParkingRequestForm.tsx.
"""

from .conftest import REQUEST_PAYLOAD, register_and_login


def _submit(client, headers):
    return client.post("/api/requests", json=REQUEST_PAYLOAD, headers=headers)


def test_default_limit_is_ten_pending_requests(client, user_headers, monkeypatch):
    monkeypatch.delenv("MAX_PENDING_REQUESTS", raising=False)

    for i in range(10):
        resp = _submit(client, user_headers)
        assert resp.status_code == 201, f"request {i + 1} should be accepted: {resp.text}"

    resp = _submit(client, user_headers)
    assert resp.status_code == 400
    assert "Maximum limit of 10 pending requests" in resp.json()["detail"]


def test_limit_follows_the_environment_setting(client, user_headers, monkeypatch):
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "2")

    assert _submit(client, user_headers).status_code == 201
    assert _submit(client, user_headers).status_code == 201

    resp = _submit(client, user_headers)
    assert resp.status_code == 400
    assert "Maximum limit of 2 pending requests" in resp.json()["detail"]


def test_rejected_submission_is_not_stored(client, user_headers, monkeypatch):
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "1")
    assert _submit(client, user_headers).status_code == 201
    assert _submit(client, user_headers).status_code == 400

    mine = client.get("/api/requests/me", headers=user_headers).json()
    assert len(mine) == 1


def test_limit_is_per_user(client, user_headers, monkeypatch):
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "1")
    assert _submit(client, user_headers).status_code == 201
    assert _submit(client, user_headers).status_code == 400

    other = register_and_login(client, "Dave Other", "dave@test.com", "Pass1234", "user")
    assert _submit(client, other).status_code == 201


def test_cancelling_a_request_frees_a_slot(client, user_headers, monkeypatch):
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "1")
    first = _submit(client, user_headers)
    assert first.status_code == 201
    assert _submit(client, user_headers).status_code == 400

    assert client.delete(f"/api/requests/{first.json()['id']}", headers=user_headers).status_code == 204
    assert _submit(client, user_headers).status_code == 201


def test_approved_request_no_longer_counts_as_pending(client, user_headers, owner_headers, monkeypatch):
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "1")
    first = _submit(client, user_headers)
    assert first.status_code == 201
    assert _submit(client, user_headers).status_code == 400

    approve = client.patch(f"/api/requests/{first.json()['id']}/approve", json={}, headers=owner_headers)
    assert approve.status_code == 200

    assert _submit(client, user_headers).status_code == 201


def test_rejected_request_no_longer_counts_as_pending(client, user_headers, owner_headers, monkeypatch):
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "1")
    first = _submit(client, user_headers)
    assert first.status_code == 201

    reject = client.patch(f"/api/requests/{first.json()['id']}/reject", headers=owner_headers)
    assert reject.status_code == 200

    assert _submit(client, user_headers).status_code == 201
