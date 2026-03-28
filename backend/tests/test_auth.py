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
        "name": "Alice", "email": "alice@test.com", "password": "pass123", "role": "user",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "alice@test.com"
    assert data["role"] == "user"
    assert "id" in data
    assert "password_hash" not in data  # never exposed


def test_register_default_role_is_user(client):
    resp = client.post("/auth/register", json={
        "name": "Bob", "email": "bob@test.com", "password": "pass123",
    })
    assert resp.status_code == 201
    assert resp.json()["role"] == "user"


def test_register_duplicate_email_returns_400(client):
    payload = {"name": "A", "email": "dup@test.com", "password": "pass123"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


# ── Login ──────────────────────────────────────────────────────────────────

def test_login_success_returns_token_and_user_fields(client):
    client.post("/auth/register", json={
        "name": "Carol", "email": "carol@test.com", "password": "secret", "role": "owner",
    })
    resp = login(client, "carol@test.com", "secret")
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["email"] == "carol@test.com"
    assert data["role"] == "owner"
    assert data["name"] == "Carol"


def test_login_wrong_password_returns_401(client):
    client.post("/auth/register", json={
        "name": "Dave", "email": "dave@test.com", "password": "correct",
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


def test_me_without_token_returns_401(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_with_garbage_token_returns_401(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401
