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


# ── Owner lot-scoping (M-1) ───────────────────────────────────────────────

def test_owner_cannot_access_messages_for_request_assigned_to_another_owner(client, user_headers, manager_headers):
    """An owner must not read/post messages on a request whose lot belongs to a different owner."""
    # Register a second owner
    client.post("/auth/register", json={
        "name": "Eve Owner",
        "email": "eve@test.com",
        "password": "Pass1234",
        "role": "owner",
    })
    eve_resp = client.post(
        "/auth/login",
        data={"username": "eve@test.com", "password": "Pass1234"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    eve_headers = {"Authorization": f"Bearer {eve_resp.json()['access_token']}"}
    eve_id = eve_resp.json()["user_id"]

    # Create a request and a lot owned by Eve; approve it via manager
    from .conftest import REQUEST_PAYLOAD
    req_resp = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    rid = req_resp.json()["id"]

    client.post("/api/lots", json={
        "id": "F9-001", "floor": "F9", "floor_label": "F9 - Test Floor",
        "owner": "Eve Owner", "owner_id": eve_id, "status": "available",
    }, headers=manager_headers)

    # Manager approves and assigns Eve's lot
    client.patch(f"/api/requests/{rid}/approve", json={
        "lot_id": "F9-001", "floor": "F9", "lot_owner": "Eve Owner",
    }, headers=manager_headers)

    # Register a third owner (Frank) who owns no lots
    client.post("/auth/register", json={
        "name": "Frank Owner",
        "email": "frank@test.com",
        "password": "Pass1234",
        "role": "owner",
    })
    frank_resp = client.post(
        "/auth/login",
        data={"username": "frank@test.com", "password": "Pass1234"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    frank_headers = {"Authorization": f"Bearer {frank_resp.json()['access_token']}"}

    # Frank cannot read or post messages on this request (lot belongs to Eve)
    assert client.get(f"/api/requests/{rid}/messages", headers=frank_headers).status_code == 403
    assert client.post(
        f"/api/requests/{rid}/messages", json={"text": "Hi"}, headers=frank_headers
    ).status_code == 403

    # Eve (the lot owner) can read and post messages
    assert client.get(f"/api/requests/{rid}/messages", headers=eve_headers).status_code == 200
    assert client.post(
        f"/api/requests/{rid}/messages", json={"text": "Hi from Eve"}, headers=eve_headers
    ).status_code == 201


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register_and_login_user(client) -> dict:
    """Register a second plain user and return auth headers."""
    client.post("/auth/register", json={
        "name": "Other User",
        "email": "other@test.com",
        "password": "Pass1234",
        "role": "user",
    })
    resp = client.post(
        "/auth/login",
        data={"username": "other@test.com", "password": "Pass1234"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
