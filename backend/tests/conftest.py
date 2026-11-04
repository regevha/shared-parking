"""
Shared fixtures for the parking API test suite.

Each test gets a completely fresh in-memory SQLite database.
StaticPool ensures all SQLAlchemy sessions share the same underlying
connection so schema and data are visible across the ORM's pool.
"""

import sys
import os
import datetime
import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# auth.py refuses to import without SECRET_KEY. Use a throwaway test key so the
# suite runs on a fresh clone with no .env file (the real .env is not committed).
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-do-not-use-in-production")

# Make the backend package importable when running pytest from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import models
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

def promote_user(db_session, email: str, role: str) -> None:
    """Set a user's role directly in the test DB.

    Public registration always creates role="user" (see routers/auth.py), so
    tests that need an owner or manager promote the account here instead.
    """
    user = db_session.query(models.User).filter(models.User.email == email).first()
    assert user is not None, f"No user {email} to promote"
    user.role = role
    db_session.commit()


def register_and_login(client, name: str, email: str, password: str, role: str, db_session=None) -> dict:
    """Register a user (promoting to `role` via the DB if needed) and return auth headers."""
    client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
    })
    if role != "user":
        assert db_session is not None, "db_session is required to create an owner/manager"
        promote_user(db_session, email, role)
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
    return register_and_login(client, "Alice User", "alice@test.com", "Pass1234", "user")


@pytest.fixture()
def owner_headers(client, db_session) -> dict:
    return register_and_login(client, "Bob Owner", "bob@test.com", "Pass1234", "owner", db_session)


@pytest.fixture()
def manager_headers(client, db_session) -> dict:
    return register_and_login(client, "Carol Manager", "carol@test.com", "Pass1234", "manager", db_session)


# ── Request helpers ────────────────────────────────────────────────────────

_FUTURE_DATE = (date.today() + timedelta(days=7)).isoformat()

REQUEST_PAYLOAD = {
    "requester_id":   "ignored",
    "requester_name": "ignored",
    "date":           _FUTURE_DATE,
    "start_time":     "09:00",
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


def create_lot_owned_by(client, manager_headers, owner_headers, lot_id: str, floor: str = "F1") -> dict:
    """Create a lot owned by the owner fixture, with full-week availability windows so owners can approve."""
    me = client.get("/auth/me", headers=owner_headers).json()
    resp = client.post("/api/lots", json={
        "id": lot_id,
        "floor": floor,
        "floor_label": f"{floor} - Test Floor",
        "owner": me["name"],
        "owner_id": me["id"],
        "status": "available",
    }, headers=manager_headers)
    assert resp.status_code == 201, resp.text
    # Owned lots are blocked by default — create Mon-Sun windows so the owner can approve
    for dow in range(7):
        client.post(f"/api/lots/{lot_id}/availability", json={
            "day_of_week": dow,
            "start_time": "00:00",
            "end_time": "23:59",
        }, headers=owner_headers)
    return resp.json()


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
