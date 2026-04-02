"""
Shared fixtures for the parking API test suite.

Each test gets a completely fresh in-memory SQLite database.
StaticPool ensures all SQLAlchemy sessions share the same underlying
connection so schema and data are visible across the ORM's pool.
"""

import sys
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Make the backend package importable when running pytest from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, get_db
from main import app

SQLITE_IN_MEMORY = "sqlite://"


# ── Database fixtures ──────────────────────────────────────────────────────

@pytest.fixture()
def db_engine():
    """Fresh in-memory SQLite engine with schema created per test."""
    engine = create_engine(
        SQLITE_IN_MEMORY,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    """Session bound to the per-test in-memory database."""
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSession()
    yield session
    session.close()


# ── TestClient fixture ─────────────────────────────────────────────────────

@pytest.fixture()
def client(db_session):
    """
    TestClient with get_db overridden to use the per-test session.
    dependency_overrides is cleared on teardown so tests are isolated.
    """
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Auth helpers ───────────────────────────────────────────────────────────

def register_and_login(client, name: str, email: str, password: str, role: str) -> dict:
    """Register a user and return their Authorization headers."""
    client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
        "role": role,
    })
    resp = client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def user_headers(client) -> dict:
    return register_and_login(client, "Alice User", "alice@test.com", "pass123", "user")


@pytest.fixture()
def owner_headers(client) -> dict:
    return register_and_login(client, "Bob Owner", "bob@test.com", "pass123", "owner")


@pytest.fixture()
def manager_headers(client) -> dict:
    return register_and_login(client, "Carol Manager", "carol@test.com", "pass123", "manager")


# ── Request helpers ────────────────────────────────────────────────────────

REQUEST_PAYLOAD = {
    "requester_id":   "ignored",
    "requester_name": "ignored",
    "date":           "2026-04-10",
    "start_time":     "09:00",
    "end_time":       "11:00",
    "duration":       2,
}


@pytest.fixture()
def created_request_id(client, user_headers) -> str:
    """Creates a pending request as the user fixture and returns its id."""
    resp = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ── Lot helpers ────────────────────────────────────────────────────────────

LOT_PAYLOAD = {
    "id":          "F1-001",
    "floor":       "F1",
    "floor_label": "F1 - Ground Floor",
    "status":      "available",
}


@pytest.fixture()
def created_lot_id(client, manager_headers) -> str:
    """Creates a lot as the manager fixture and returns its id."""
    resp = client.post("/api/lots", json=LOT_PAYLOAD, headers=manager_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.fixture()
def owner_lot_id(client, manager_headers, owner_headers) -> str:
    """Creates a lot owned by the owner fixture and returns its id."""
    # First find the owner's user id
    me_resp = client.get("/auth/me", headers=owner_headers)
    owner_id = me_resp.json()["id"]
    owner_name = me_resp.json()["name"]

    resp = client.post("/api/lots", json={
        "id":          "F2-001",
        "floor":       "F2",
        "floor_label": "F2 - Level 1",
        "owner":       owner_name,
        "owner_id":    owner_id,
        "status":      "available",
    }, headers=manager_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
