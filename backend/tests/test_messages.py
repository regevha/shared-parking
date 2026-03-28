"""Tests for /api/requests/{id}/messages endpoints."""

import pytest
from .conftest import REQUEST_PAYLOAD


# ── GET /api/requests/{id}/messages ──────────────────────────────────────────

def test_get_messages_empty_initially(client, user_headers, created_request_id):
    resp = client.get(f"/api/requests/{created_request_id}/messages", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_messages_requires_auth(client, created_request_id):
    resp = client.get(f"/api/requests/{created_request_id}/messages")
    assert resp.status_code == 401


def test_get_messages_nonexistent_request_returns_404(client, user_headers):
    resp = client.get("/api/requests/REQ-999/messages", headers=user_headers)
    assert resp.status_code == 404


def test_user_cannot_get_messages_for_others_request(client, owner_headers, created_request_id):
    # created_request_id belongs to the user fixture; owner is a different user with role 'owner'
    # owner role CAN see all messages — test a plain second user instead
    other_headers = _register_and_login_user(client)
    resp = client.get(f"/api/requests/{created_request_id}/messages", headers=other_headers)
    assert resp.status_code == 403


def test_owner_can_get_messages_for_any_request(client, owner_headers, created_request_id):
    resp = client.get(f"/api/requests/{created_request_id}/messages", headers=owner_headers)
    assert resp.status_code == 200


def test_manager_can_get_messages_for_any_request(client, manager_headers, created_request_id):
    resp = client.get(f"/api/requests/{created_request_id}/messages", headers=manager_headers)
    assert resp.status_code == 200


# ── POST /api/requests/{id}/messages ─────────────────────────────────────────

def test_requester_can_send_message(client, user_headers, created_request_id):
    resp = client.post(
        f"/api/requests/{created_request_id}/messages",
        json={"text": "Hello, is this lot covered?"},
        headers=user_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["text"] == "Hello, is this lot covered?"
    assert data["sender_name"] == "Alice User"
    assert data["sender_role"] == "user"
    assert data["request_id"] == created_request_id


def test_owner_can_send_message(client, owner_headers, created_request_id):
    resp = client.post(
        f"/api/requests/{created_request_id}/messages",
        json={"text": "Yes, it is covered."},
        headers=owner_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["sender_role"] == "owner"


def test_send_message_requires_auth(client, created_request_id):
    resp = client.post(
        f"/api/requests/{created_request_id}/messages",
        json={"text": "Hi"},
    )
    assert resp.status_code == 401


def test_send_message_nonexistent_request_returns_404(client, user_headers):
    resp = client.post(
        "/api/requests/REQ-999/messages",
        json={"text": "Hi"},
        headers=user_headers,
    )
    assert resp.status_code == 404


def test_other_user_cannot_send_message(client, created_request_id):
    other_headers = _register_and_login_user(client)
    resp = client.post(
        f"/api/requests/{created_request_id}/messages",
        json={"text": "Hi"},
        headers=other_headers,
    )
    assert resp.status_code == 403


def test_send_message_rejects_empty_text(client, user_headers, created_request_id):
    resp = client.post(
        f"/api/requests/{created_request_id}/messages",
        json={"text": "   "},
        headers=user_headers,
    )
    assert resp.status_code == 422


def test_send_message_rejects_text_over_1000_chars(client, user_headers, created_request_id):
    resp = client.post(
        f"/api/requests/{created_request_id}/messages",
        json={"text": "x" * 1001},
        headers=user_headers,
    )
    assert resp.status_code == 422


def test_messages_returned_in_order(client, user_headers, owner_headers, created_request_id):
    client.post(f"/api/requests/{created_request_id}/messages",
                json={"text": "First"}, headers=user_headers)
    client.post(f"/api/requests/{created_request_id}/messages",
                json={"text": "Second"}, headers=owner_headers)
    client.post(f"/api/requests/{created_request_id}/messages",
                json={"text": "Third"}, headers=user_headers)

    resp = client.get(f"/api/requests/{created_request_id}/messages", headers=user_headers)
    texts = [m["text"] for m in resp.json()]
    assert texts == ["First", "Second", "Third"]


def test_messages_isolated_per_request(client, user_headers, owner_headers):
    r1 = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    r2 = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    id1, id2 = r1.json()["id"], r2.json()["id"]

    client.post(f"/api/requests/{id1}/messages",
                json={"text": "Only for request 1"}, headers=user_headers)

    resp = client.get(f"/api/requests/{id2}/messages", headers=user_headers)
    assert resp.json() == []


def test_messages_preserved_after_request_deletion(client, db_session, user_headers):
    """Messages survive request deletion (SET NULL) for 7-day audit retention."""
    import models as m

    r = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    rid = r.json()["id"]
    client.post(f"/api/requests/{rid}/messages",
                json={"text": "Audit trail message"}, headers=user_headers)

    client.delete(f"/api/requests/{rid}", headers=user_headers)

    # Request is gone — messages endpoint returns 404
    assert client.get(f"/api/requests/{rid}/messages", headers=user_headers).status_code == 404

    # Message row survives with request_id set to NULL
    archived = db_session.query(m.RequestMessage).filter(m.RequestMessage.request_id == None).all()  # noqa: E711
    assert len(archived) == 1
    assert archived[0].text == "Audit trail message"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register_and_login_user(client) -> dict:
    """Register a second plain user and return auth headers."""
    client.post("/auth/register", json={
        "name": "Other User",
        "email": "other@test.com",
        "password": "pass123",
        "role": "user",
    })
    resp = client.post(
        "/auth/login",
        data={"username": "other@test.com", "password": "pass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
