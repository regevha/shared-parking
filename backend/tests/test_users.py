"""Tests for /api/users/* endpoints."""

import pytest


def get_user_id(client, headers) -> str:
    return client.get("/auth/me", headers=headers).json()["id"]


# ── GET /api/users ────────────────────────────────────────────────────────

def test_list_users_as_manager(client, user_headers, owner_headers, manager_headers):
    # Three users registered by the fixtures
    resp = client.get("/api/users", headers=manager_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_list_users_requires_manager_role(client, owner_headers):
    resp = client.get("/api/users", headers=owner_headers)
    assert resp.status_code == 403


def test_list_users_requires_auth(client):
    resp = client.get("/api/users")
    assert resp.status_code == 401


# ── GET /api/users/me ─────────────────────────────────────────────────────

def test_get_me_returns_authenticated_user(client, user_headers):
    resp = client.get("/api/users/me", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@test.com"


# ── GET /api/users/{user_id} ──────────────────────────────────────────────

def test_manager_can_get_any_user(client, user_headers, manager_headers):
    uid = get_user_id(client, user_headers)
    resp = client.get(f"/api/users/{uid}", headers=manager_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@test.com"


def test_user_can_get_own_profile(client, user_headers):
    uid = get_user_id(client, user_headers)
    resp = client.get(f"/api/users/{uid}", headers=user_headers)
    assert resp.status_code == 200


def test_user_cannot_get_other_user_returns_403(client, user_headers, owner_headers):
    owner_id = get_user_id(client, owner_headers)
    resp = client.get(f"/api/users/{owner_id}", headers=user_headers)
    assert resp.status_code == 403


def test_get_nonexistent_user_returns_404(client, manager_headers):
    resp = client.get("/api/users/nonexistent-id", headers=manager_headers)
    assert resp.status_code == 404


# ── PATCH /api/users/{user_id} ────────────────────────────────────────────

def test_user_can_update_own_name(client, user_headers):
    uid = get_user_id(client, user_headers)
    resp = client.patch(f"/api/users/{uid}", json={"name": "Alice Updated"}, headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Alice Updated"


def test_user_can_update_own_email(client, user_headers):
    uid = get_user_id(client, user_headers)
    resp = client.patch(f"/api/users/{uid}", json={"email": "alice2@test.com"}, headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice2@test.com"


def test_user_cannot_change_own_role_returns_403(client, user_headers):
    uid = get_user_id(client, user_headers)
    resp = client.patch(f"/api/users/{uid}", json={"role": "manager"}, headers=user_headers)
    assert resp.status_code == 403
    assert "managers" in resp.json()["detail"].lower()


def test_manager_can_change_any_users_role(client, user_headers, manager_headers):
    uid = get_user_id(client, user_headers)
    resp = client.patch(f"/api/users/{uid}", json={"role": "owner"}, headers=manager_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "owner"


def test_update_email_conflict_returns_400(client, user_headers, owner_headers):
    owner_id = get_user_id(client, owner_headers)
    # Try to steal Alice's email for Bob (owner)
    resp = client.patch(
        f"/api/users/{owner_id}",
        json={"email": "alice@test.com"},
        headers=owner_headers,
    )
    assert resp.status_code == 400
    assert "already in use" in resp.json()["detail"].lower()


def test_user_cannot_update_another_user_returns_403(client, user_headers, owner_headers):
    owner_id = get_user_id(client, owner_headers)
    resp = client.patch(
        f"/api/users/{owner_id}",
        json={"name": "Hacked"},
        headers=user_headers,
    )
    assert resp.status_code == 403


def test_update_nonexistent_user_returns_404(client, manager_headers):
    resp = client.patch(
        "/api/users/nonexistent-id",
        json={"name": "Ghost"},
        headers=manager_headers,
    )
    assert resp.status_code == 404


def test_password_update_enables_new_login(client, user_headers):
    uid = get_user_id(client, user_headers)
    client.patch(f"/api/users/{uid}", json={"password": "newpass456"}, headers=user_headers)
    # New password works
    resp = client.post(
        "/auth/login",
        data={"username": "alice@test.com", "password": "newpass456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    # Old password no longer works
    resp2 = client.post(
        "/auth/login",
        data={"username": "alice@test.com", "password": "pass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp2.status_code == 401


# ── DELETE /api/users/{user_id} ───────────────────────────────────────────

def test_manager_can_delete_another_user(client, user_headers, manager_headers):
    uid = get_user_id(client, user_headers)
    resp = client.delete(f"/api/users/{uid}", headers=manager_headers)
    assert resp.status_code == 204
    # Verify gone
    get_resp = client.get(f"/api/users/{uid}", headers=manager_headers)
    assert get_resp.status_code == 404


def test_manager_cannot_delete_self_returns_400(client, manager_headers):
    manager_id = get_user_id(client, manager_headers)
    resp = client.delete(f"/api/users/{manager_id}", headers=manager_headers)
    assert resp.status_code == 400
    assert "own account" in resp.json()["detail"].lower()


def test_delete_user_requires_manager_role(client, owner_headers, user_headers):
    uid = get_user_id(client, user_headers)
    resp = client.delete(f"/api/users/{uid}", headers=owner_headers)
    assert resp.status_code == 403


def test_delete_nonexistent_user_returns_404(client, manager_headers):
    resp = client.delete("/api/users/nonexistent-id", headers=manager_headers)
    assert resp.status_code == 404
