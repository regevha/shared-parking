"""
Tests for system-level endpoints: the health route, GET /api/config, and the manual auto-approve trigger
(POST /api/requests/run-auto-approve).

The config router's own trigger (POST /api/config/run-auto-approval) is covered in test_e2e_auto_approval.py.
"""

from .conftest import REQUEST_PAYLOAD


# ── GET / (health) ─────────────────────────────────────────────────────────

def test_root_health_check_is_public(client):
    """Used by CI and uptime checks, so it must work without a token."""
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── GET /api/config ────────────────────────────────────────────────────────

def test_config_requires_auth(client):
    assert client.get("/api/config").status_code == 401


def test_config_available_to_every_role(client, user_headers, owner_headers, manager_headers):
    for headers in (user_headers, owner_headers, manager_headers):
        resp = client.get("/api/config", headers=headers)
        assert resp.status_code == 200
        assert set(resp.json()) == {"timezone", "blackout_start", "blackout_end", "max_pending_requests_per_user"}


def test_config_defaults(client, user_headers, monkeypatch):
    for name in ("TIMEZONE", "BLACKOUT_START", "BLACKOUT_END", "MAX_PENDING_REQUESTS"):
        monkeypatch.delenv(name, raising=False)

    cfg = client.get("/api/config", headers=user_headers).json()
    assert cfg["blackout_start"] == "22:00"
    assert cfg["blackout_end"] == "06:00"
    assert cfg["max_pending_requests_per_user"] == 10


def test_config_reflects_environment_overrides(client, user_headers, monkeypatch):
    monkeypatch.setenv("TIMEZONE", "Asia/Jerusalem")
    monkeypatch.setenv("BLACKOUT_START", "23:30")
    monkeypatch.setenv("BLACKOUT_END", "05:30")
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "4")

    assert client.get("/api/config", headers=user_headers).json() == {
        "timezone": "Asia/Jerusalem",
        "blackout_start": "23:30",
        "blackout_end": "05:30",
        "max_pending_requests_per_user": 4,
    }


def test_config_limit_matches_what_submission_enforces(client, user_headers, monkeypatch):
    """The number advertised to the UI must be the number the API actually enforces."""
    monkeypatch.setenv("MAX_PENDING_REQUESTS", "1")
    advertised = client.get("/api/config", headers=user_headers).json()["max_pending_requests_per_user"]
    assert advertised == 1

    assert client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers).status_code == 201
    assert client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers).status_code == 400


# ── POST /api/requests/run-auto-approve ────────────────────────────────────

def test_run_auto_approve_requires_auth(client):
    assert client.post("/api/requests/run-auto-approve").status_code == 401


def test_run_auto_approve_forbidden_for_regular_user(client, user_headers):
    resp = client.post("/api/requests/run-auto-approve", headers=user_headers)
    assert resp.status_code == 403
    assert "managers" in resp.json()["detail"].lower()


def test_run_auto_approve_forbidden_for_owner(client, owner_headers):
    assert client.post("/api/requests/run-auto-approve", headers=owner_headers).status_code == 403


def test_run_auto_approve_with_nothing_pending_is_a_noop(client, manager_headers):
    resp = client.post("/api/requests/run-auto-approve", headers=manager_headers)
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_run_auto_approve_approves_a_pending_request(client, user_headers, manager_headers):
    lot = client.post("/api/lots", json={
        "id": "AUTO-1", "floor": "F1", "floor_label": "Floor 1", "status": "available",
    }, headers=manager_headers)
    assert lot.status_code == 201
    created = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert created.status_code == 201
    request_id = created.json()["id"]

    resp = client.post("/api/requests/run-auto-approve", headers=manager_headers)
    assert resp.status_code == 200

    mine = {r["id"]: r for r in client.get("/api/requests/me", headers=user_headers).json()}
    assert mine[request_id]["status"] == "approved"
    assert mine[request_id]["approved_by"] == "auto"
    assert mine[request_id]["lot_id"] == "AUTO-1"
