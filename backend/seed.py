"""
Seed the SQLite database with sample users, requests and lots.
Run once: python seed.py
Safe to re-run — clears existing data first.
"""

import uuid
from database import SessionLocal, engine, Base
from auth import hash_password
import models

Base.metadata.create_all(bind=engine)

# ── Sample users ──────────────────────────────────────────────────────────────
# Passwords are all "password123" for development convenience
USERS = [
    dict(id="owner-001", name="Sarah Johnson",   email="sarah@parking.dev",    role="owner"),
    dict(id="owner-002", name="Mike Chen",        email="mike@parking.dev",     role="owner"),
    dict(id="owner-003", name="David Wilson",     email="david@parking.dev",    role="owner"),
    dict(id="owner-004", name="Lisa Anderson",    email="lisa@parking.dev",     role="owner"),
    dict(id="owner-005", name="James Taylor",     email="james@parking.dev",    role="owner"),
    dict(id="owner-006", name="Patricia Brown",   email="patricia@parking.dev", role="owner"),
    dict(id="owner-007", name="Robert Garcia",    email="robert@parking.dev",   role="owner"),
    dict(id="owner-008", name="Jennifer Lee",     email="jennifer@parking.dev", role="owner"),
    dict(id="user-001",  name="Alice Johnson",    email="alice@parking.dev",    role="user"),
    dict(id="user-002",  name="Bob Smith",        email="bob@parking.dev",      role="user"),
    dict(id="user-003",  name="Carol Williams",   email="carol@parking.dev",    role="user"),
    dict(id="user-004",  name="Emma Brown",       email="emma@parking.dev",     role="user"),
    dict(id="user-005",  name="Frank Davis",      email="frank@parking.dev",    role="user"),
    dict(id="user-006",  name="George Miller",    email="george@parking.dev",   role="user"),
    dict(id="user-007",  name="Helen Garcia",     email="helen@parking.dev",    role="user"),
    dict(id="user-008",  name="Tom Harris",       email="tom@parking.dev",      role="user"),
    dict(id="user-009",  name="Nina Patel",       email="nina@parking.dev",     role="user"),
    dict(id="user-010",  name="David Lee",        email="davidlee@parking.dev", role="user"),
    dict(id="user-011",  name="Maria Garcia",     email="maria@parking.dev",    role="user"),
    dict(id="user-012",  name="James Wilson",     email="jameswilson@parking.dev", role="user"),
    dict(id="manager-001", name="Admin Manager",  email="admin@parking.dev",    role="manager"),
]

# ── Lot owner lookup by name ───────────────────────────────────────────────────
OWNER_ID_BY_NAME = {u["name"]: u["id"] for u in USERS if u["role"] == "owner"}

# ── Sample parking requests ───────────────────────────────────────────────────
PENDING_REQUESTS = [
    dict(id="REQ-010", requester_id="user-001", requester_name="Alice Johnson",  date="2026-03-28", start_time="09:00", end_time="11:00", duration=2, submitted_at="2026-03-25T14:30:00Z", status="pending"),
    dict(id="REQ-011", requester_id="user-002", requester_name="Bob Smith",      date="2026-03-29", start_time="13:00", end_time="15:00", duration=2, submitted_at="2026-03-25T15:45:00Z", status="pending"),
    dict(id="REQ-012", requester_id="user-003", requester_name="Carol Williams", date="2026-03-29", start_time="10:00", end_time="13:00", duration=3, submitted_at="2026-03-25T16:00:00Z", status="pending", rejected_by_owner=True),
    dict(id="REQ-013", requester_id="owner-001", requester_name="Sarah Johnson", date="2026-03-30", start_time="14:00", end_time="17:00", duration=3, submitted_at="2026-03-25T16:30:00Z", status="pending"),
    dict(id="REQ-014", requester_id="user-004", requester_name="Emma Brown",     date="2026-03-30", start_time="08:00", end_time="12:00", duration=4, submitted_at="2026-03-26T09:00:00Z", status="pending"),
    dict(id="REQ-015", requester_id="user-005", requester_name="Frank Davis",    date="2026-03-31", start_time="15:00", end_time="18:00", duration=3, submitted_at="2026-03-26T10:00:00Z", status="pending"),
    dict(id="REQ-018", requester_id="user-010", requester_name="David Lee",      date="2026-03-26", start_time="17:00", end_time="19:00", duration=2, submitted_at="2026-03-26T14:00:00Z", status="pending"),
    dict(id="REQ-019", requester_id="user-011", requester_name="Maria Garcia",   date="2026-03-26", start_time="18:00", end_time="20:00", duration=2, submitted_at="2026-03-26T15:00:00Z", status="pending"),
]

APPROVED_REQUESTS = [
    dict(id="REQ-001", requester_id="user-001", requester_name="Alice Johnson",  date="2026-03-24", start_time="09:00", end_time="11:00", duration=2, submitted_at="2026-03-22T14:30:00Z", status="approved", lot_id="F2-003", floor="F2 - Level 1",     lot_owner="Lisa Anderson",  approved_at="2026-03-22T16:45:00Z"),
    dict(id="REQ-002", requester_id="user-002", requester_name="Bob Smith",      date="2026-03-24", start_time="13:00", end_time="15:00", duration=2, submitted_at="2026-03-22T09:45:00Z", status="approved", lot_id="F1-002", floor="F1 - Ground Floor", lot_owner="Sarah Johnson", approved_at="2026-03-22T10:15:00Z"),
    dict(id="REQ-003", requester_id="user-003", requester_name="Carol Williams", date="2026-03-26", start_time="10:00", end_time="13:00", duration=3, submitted_at="2026-03-23T10:00:00Z", status="approved", lot_id="F3-005", floor="F3 - Level 2",     lot_owner="Jennifer Lee",  approved_at="2026-03-23T11:30:00Z"),
    dict(id="REQ-004", requester_id="user-005", requester_name="Frank Davis",    date="2026-03-27", start_time="15:00", end_time="18:00", duration=3, submitted_at="2026-03-23T13:15:00Z", status="approved", lot_id="F2-001", floor="F2 - Level 1",     lot_owner="David Wilson",  approved_at="2026-03-23T14:20:00Z"),
    dict(id="REQ-005", requester_id="user-004", requester_name="Emma Brown",     date="2026-03-24", start_time="08:00", end_time="12:00", duration=4, submitted_at="2026-03-22T15:30:00Z", status="approved", lot_id="F1-004", floor="F1 - Ground Floor", lot_owner="Mike Chen",     approved_at="2026-03-22T16:00:00Z"),
    dict(id="REQ-006", requester_id="user-006", requester_name="George Miller",  date="2026-03-25", start_time="14:00", end_time="17:00", duration=3, submitted_at="2026-03-23T09:00:00Z", status="approved", lot_id="F3-001", floor="F3 - Level 2",     lot_owner="Patricia Brown",approved_at="2026-03-23T09:45:00Z"),
    dict(id="REQ-007", requester_id="user-007", requester_name="Helen Garcia",   date="2026-03-26", start_time="11:00", end_time="13:00", duration=2, submitted_at="2026-03-23T11:45:00Z", status="approved", lot_id="F2-004", floor="F2 - Level 1",     lot_owner="James Taylor",  approved_at="2026-03-23T12:30:00Z"),
    dict(id="REQ-008", requester_id="user-008", requester_name="Tom Harris",     date="2026-03-26", start_time="09:00", end_time="11:00", duration=2, submitted_at="2026-03-24T08:00:00Z", status="approved", lot_id="F1-001", floor="F1 - Ground Floor", lot_owner="Sarah Johnson", approved_at="2026-03-24T08:30:00Z"),
    dict(id="REQ-009", requester_id="user-009", requester_name="Nina Patel",     date="2026-03-27", start_time="14:00", end_time="17:00", duration=3, submitted_at="2026-03-24T10:30:00Z", status="approved", lot_id="F1-006", floor="F1 - Ground Floor", lot_owner="Sarah Johnson", approved_at="2026-03-24T11:00:00Z"),
    dict(id="REQ-016", requester_id="owner-001", requester_name="Sarah Johnson", date="2026-03-22", start_time="14:00", end_time="16:00", duration=2, submitted_at="2026-03-21T10:00:00Z", status="approved", lot_id="F3-003", floor="F3 - Level 2",     lot_owner="Robert Garcia", approved_at="2026-03-21T11:00:00Z"),
    dict(id="REQ-020", requester_id="user-012", requester_name="James Wilson",   date="2026-03-26", start_time="16:00", end_time="18:00", duration=2, submitted_at="2026-03-26T12:00:00Z", status="approved", lot_id="F1-001", floor="F1 - Ground Floor", lot_owner="Sarah Johnson", approved_at="2026-03-26T13:00:00Z"),
]

REJECTED_REQUESTS = [
    dict(id="REQ-017", requester_id="owner-001", requester_name="Sarah Johnson", date="2026-03-19", start_time="10:00", end_time="12:00", duration=2, submitted_at="2026-03-17T12:00:00Z", status="rejected", lot_id="F2-001", floor="F2 - Level 1", lot_owner="David Wilson"),
]

LOTS = [
    dict(id="F1-001", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  owner_id="owner-001", status="available"),
    dict(id="F1-002", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  owner_id="owner-001", status="blocked",  blocked_until="2026-03-28 14:00"),
    dict(id="F1-003", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",      owner_id="owner-002", status="available"),
    dict(id="F1-004", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",      owner_id="owner-002", status="available"),
    dict(id="F1-005", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",      owner_id="owner-002", status="blocked",  blocked_until="2026-03-29 10:00"),
    dict(id="F1-006", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  owner_id="owner-001", status="available"),
    dict(id="F2-001", floor="F2", floor_label="F2 - Level 1",      owner="David Wilson",   owner_id="owner-003", status="available"),
    dict(id="F2-002", floor="F2", floor_label="F2 - Level 1",      owner="David Wilson",   owner_id="owner-003", status="available"),
    dict(id="F2-003", floor="F2", floor_label="F2 - Level 1",      owner="Lisa Anderson",  owner_id="owner-004", status="blocked",  blocked_until="2026-03-28 09:30"),
    dict(id="F2-004", floor="F2", floor_label="F2 - Level 1",      owner="James Taylor",   owner_id="owner-005", status="available"),
    dict(id="F2-005", floor="F2", floor_label="F2 - Level 1",      owner="James Taylor",   owner_id="owner-005", status="blocked",  blocked_until="2026-03-30 18:00"),
    dict(id="F3-001", floor="F3", floor_label="F3 - Level 2",      owner="Patricia Brown", owner_id="owner-006", status="available"),
    dict(id="F3-002", floor="F3", floor_label="F3 - Level 2",      owner="Robert Garcia",  owner_id="owner-007", status="available"),
    dict(id="F3-003", floor="F3", floor_label="F3 - Level 2",      owner="Robert Garcia",  owner_id="owner-007", status="available"),
    dict(id="F3-004", floor="F3", floor_label="F3 - Level 2",      owner="Jennifer Lee",   owner_id="owner-008", status="blocked",  blocked_until="2026-03-28 16:30"),
    dict(id="F3-005", floor="F3", floor_label="F3 - Level 2",      owner="Jennifer Lee",   owner_id="owner-008", status="blocked",  blocked_until="2026-03-29 11:00"),
    dict(id="F3-006", floor="F3", floor_label="F3 - Level 2",      owner=None,             owner_id=None,        status="unowned"),
]


def seed():
    db = SessionLocal()
    try:
        db.query(models.ParkingRequest).delete()
        db.query(models.Lot).delete()
        db.query(models.User).delete()
        db.commit()

        for u in USERS:
            db.add(models.User(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                password_hash=hash_password("password123"),
                role=u["role"],
            ))

        all_requests = PENDING_REQUESTS + APPROVED_REQUESTS + REJECTED_REQUESTS
        for r in all_requests:
            db.add(models.ParkingRequest(**r))

        for l in LOTS:
            db.add(models.Lot(**l))

        db.commit()
        print(f"OK: Seeded {len(USERS)} users, {len(all_requests)} requests, {len(LOTS)} lots.")
        print("Credentials: <email>@parking.dev / password123")
        print("Example: sarah@parking.dev / password123  (Owner)")
        print("Example: alice@parking.dev / password123  (User)")
        print("Example: admin@parking.dev / password123  (Manager)")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
