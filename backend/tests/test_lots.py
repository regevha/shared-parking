"""Tests for /api/lots/* endpoints."""

import pytest
from .conftest import LOT_PAYLOAD


# ── GET /api/lots ──────────────────────────────────────────────────────────

def test_get_all_lots_empty_initially(client, user_headers):
    resp = client.get("/api/lots", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_all_lots_requires_auth(client):
    resp = client.get("/api/lots")
    assert resp.status_code == 401


def test_get_all_lots_after_creation(client, user_headers, created_lot_id):
    resp = client.get("/api/lots", headers=user_headers)
    assert resp.status_code == 200
    assert any(l["id"] == created_lot_id for l in resp.json())


# ── GET /api/lots/mine ────────────────────────────────────────────────────

def test_get_my_lots_returns_owned_lots(client, owner_headers, owner_lot_id):
    resp = client.get("/api/lots/mine", headers=owner_headers)
    assert resp.status_code == 200
    ids = [l["id"] for l in resp.json()]
    assert owner_lot_id in ids


def test_get_my_lots_excludes_unowned(client, owner_headers, created_lot_id):
    # created_lot_id has no owner_id set
    resp = client.get("/api/lots/mine", headers=owner_headers)
    ids = [l["id"] for l in resp.json()]
    assert created_lot_id not in ids


def test_get_my_lots_requires_owner_role(client, user_headers):
    resp = client.get("/api/lots/mine", headers=user_headers)
    assert resp.status_code == 403


# ── GET /api/lots/owner/{name} ────────────────────────────────────────────

def test_get_lots_by_owner_name(client, manager_headers, owner_headers):
    me = client.get("/auth/me", headers=owner_headers).json()
    client.post("/api/lots", json={
        "id": "F3-001", "floor": "F3", "floor_label": "F3 - Level 2",
        "owner": me["name"], "owner_id": me["id"], "status": "available",
    }, headers=manager_headers)
    resp = client.get(f"/api/lots/owner/{me['name']}", headers=owner_headers)
    assert resp.status_code == 200
    assert any(l["id"] == "F3-001" for l in resp.json())


def test_get_lots_by_unknown_owner_returns_empty(client, user_headers):
    resp = client.get("/api/lots/owner/Nobody", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json() == []


# ── POST /api/lots ────────────────────────────────────────────────────────

def test_create_lot_success_as_manager(client, manager_headers):
    resp = client.post("/api/lots", json=LOT_PAYLOAD, headers=manager_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "F1-001"
    assert data["status"] == "available"
    assert data["floor_label"] == "F1 - Ground Floor"


def test_create_lot_requires_manager_role(client, owner_headers):
    resp = client.post("/api/lots", json=LOT_PAYLOAD, headers=owner_headers)
    assert resp.status_code == 403


def test_create_lot_requires_auth(client):
    resp = client.post("/api/lots", json=LOT_PAYLOAD)
    assert resp.status_code == 401


def test_create_lot_duplicate_id_returns_400(client, manager_headers, created_lot_id):
    resp = client.post("/api/lots", json=LOT_PAYLOAD, headers=manager_headers)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"].lower()


# ── GET /api/lots/{lot_id} ────────────────────────────────────────────────

def test_get_single_lot(client, user_headers, created_lot_id):
    resp = client.get(f"/api/lots/{created_lot_id}", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created_lot_id


def test_get_nonexistent_lot_returns_404(client, user_headers):
    resp = client.get("/api/lots/FAKE-999", headers=user_headers)
    assert resp.status_code == 404


# ── PATCH /api/lots/{lot_id} ──────────────────────────────────────────────

def test_manager_can_update_any_lot_field(client, manager_headers, owner_headers, created_lot_id):
    me = client.get("/auth/me", headers=owner_headers).json()
    resp = client.patch(f"/api/lots/{created_lot_id}", json={
        "status": "blocked",
        "blocked_until": "2026-04-30 18:00",
        "owner": me["name"],
        "owner_id": me["id"],
    }, headers=manager_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "blocked"
    assert data["blocked_until"] == "2026-04-30 18:00"
    assert data["owner"] == me["name"]


def test_owner_can_update_own_lot_status(client, manager_headers, owner_headers, owner_lot_id):
    resp = client.patch(f"/api/lots/{owner_lot_id}", json={
        "status": "blocked",
        "blocked_until": "2026-05-01 09:00",
    }, headers=owner_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "blocked"


def test_owner_cannot_reassign_ownership_returns_403(client, owner_headers, owner_lot_id):
    resp = client.patch(f"/api/lots/{owner_lot_id}", json={
        "owner": "Someone Else",
        "owner_id": "user-999",
    }, headers=owner_headers)
    assert resp.status_code == 403
    assert "managers" in resp.json()["detail"].lower()


def test_owner_cannot_update_unowned_lot_returns_403(client, owner_headers, created_lot_id):
    # created_lot_id has no owner_id so owner should be denied
    resp = client.patch(f"/api/lots/{created_lot_id}", json={"status": "blocked"}, headers=owner_headers)
    assert resp.status_code == 403


def test_update_nonexistent_lot_returns_404(client, manager_headers):
    resp = client.patch("/api/lots/FAKE-999", json={"status": "blocked"}, headers=manager_headers)
    assert resp.status_code == 404


def test_update_lot_requires_auth(client, created_lot_id):
    resp = client.patch(f"/api/lots/{created_lot_id}", json={"status": "blocked"})
    assert resp.status_code == 401


# ── DELETE /api/lots/{lot_id} ─────────────────────────────────────────────

def test_delete_lot_as_manager(client, manager_headers, user_headers, created_lot_id):
    resp = client.delete(f"/api/lots/{created_lot_id}", headers=manager_headers)
    assert resp.status_code == 204
    get_resp = client.get(f"/api/lots/{created_lot_id}", headers=user_headers)
    assert get_resp.status_code == 404


def test_delete_lot_requires_manager_role(client, owner_headers, created_lot_id):
    resp = client.delete(f"/api/lots/{created_lot_id}", headers=owner_headers)
    assert resp.status_code == 403


def test_delete_nonexistent_lot_returns_404(client, manager_headers):
    resp = client.delete("/api/lots/FAKE-999", headers=manager_headers)
    assert resp.status_code == 404
