"""Tests for /auth/* endpoints."""

import pytest


def login(client, email: str, password: str):
    return client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


# ── Register ───────────────────────────────────────────────────────────────

def test_register_success(client):
    resp = client.post("/auth/register", json={
        "name": "Alice", "email": "alice@test.com", "password": "Pass1234", "role": "user",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "alice@test.com"
    assert data["role"] == "user"
    assert "id" in data
    assert "password_hash" not in data  # never exposed


def test_register_default_role_is_user(client):
    resp = client.post("/auth/register", json={
        "name": "Bob", "email": "bob@test.com", "password": "Pass1234",
    })
    assert resp.status_code == 201
    assert resp.json()["role"] == "user"


@pytest.mark.parametrize("requested_role", ["owner", "manager"])
def test_register_cannot_self_assign_privileged_role(client, requested_role):
    """Public signup must never grant owner/manager, even if the client asks for it."""
    resp = client.post("/auth/register", json={
        "name": "Mallory", "email": "mallory@test.com", "password": "Pass1234",
        "role": requested_role,
    })
    assert resp.status_code == 201
    assert resp.json()["role"] == "user"

    token = login(client, "mallory@test.com", "Pass1234").json()
    assert token["role"] == "user"

    headers = {"Authorization": f"Bearer {token['access_token']}"}
    assert client.get("/auth/me", headers=headers).json()["role"] == "user"
    # And the privileged endpoints stay closed to the new account
    assert client.get("/api/users", headers=headers).status_code == 403


def test_register_duplicate_email_returns_400(client):
    payload = {"name": "A", "email": "dup@test.com", "password": "Pass1234"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


# ── Login ──────────────────────────────────────────────────────────────────

def test_login_success_returns_token_and_user_fields(client, db_session):
    from .conftest import promote_user

    client.post("/auth/register", json={
        "name": "Carol", "email": "carol@test.com", "password": "Secret1234",
    })
    promote_user(db_session, "carol@test.com", "owner")
    resp = login(client, "carol@test.com", "Secret1234")
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["email"] == "carol@test.com"
    assert data["role"] == "owner"
    assert data["name"] == "Carol"


def test_login_wrong_password_returns_401(client):
    client.post("/auth/register", json={
        "name": "Dave", "email": "dave@test.com", "password": "Correct1234",
    })
    resp = login(client, "dave@test.com", "wrong")
    assert resp.status_code == 401


def test_login_unknown_email_returns_401(client):
    resp = login(client, "nobody@test.com", "pass123")
    assert resp.status_code == 401


# ── /auth/me ───────────────────────────────────────────────────────────────

def test_me_returns_current_user(client, user_headers):
    resp = client.get("/auth/me", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@test.com"


# ── Password strength (M-2) ────────────────────────────────────────────────

def test_register_weak_password_too_short_returns_422(client):
    resp = client.post("/auth/register", json={
        "name": "Weak", "email": "weak@test.com", "password": "Ab1",
    })
    assert resp.status_code == 422
    assert "password" in resp.json()["detail"].lower()


def test_register_weak_password_no_uppercase_returns_422(client):
    resp = client.post("/auth/register", json={
        "name": "Weak", "email": "weak@test.com", "password": "nouppercase1",
    })
    assert resp.status_code == 422


def test_register_weak_password_no_digit_returns_422(client):
    resp = client.post("/auth/register", json={
        "name": "Weak", "email": "weak@test.com", "password": "NoDigitHere",
    })
    assert resp.status_code == 422


def test_register_strong_password_succeeds(client):
    resp = client.post("/auth/register", json={
        "name": "Strong", "email": "strong@test.com", "password": "StrongPass1",
    })
    assert resp.status_code == 201


def test_me_without_token_returns_401(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_with_garbage_token_returns_401(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


# ── Saved preferences are returned by auth endpoints ─────────────────────────

def _login(client, email="alice@test.com", password="Pass1234"):
    return client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


def test_me_and_login_return_saved_language_and_windows(client, user_headers):
    """Regression: /auth/me and /auth/login used to return only dark_mode, so the
    saved language (and windows) were never restored after a login or page reload."""
    me = client.get("/auth/me", headers=user_headers).json()
    user_id = me["id"]
    assert me["preferences"]["language"] == "en"  # default

    resp = client.patch(
        f"/api/users/{user_id}/preferences",
        json={"language": "he", "dark_mode": False,
              "notification_windows": '{"Monday": []}'},
        headers=user_headers,
    )
    assert resp.status_code == 200

    me_prefs = client.get("/auth/me", headers=user_headers).json()["preferences"]
    assert me_prefs["language"] == "he"
    assert me_prefs["dark_mode"] is False
    assert me_prefs["notification_windows"] == '{"Monday": []}'

    login_prefs = _login(client).json()["preferences"]
    assert login_prefs["language"] == "he"
    assert login_prefs["dark_mode"] is False
