"""
Seed the SQLite database with the current mock data.
Run once: python seed.py
Safe to re-run — clears existing data first.
"""

from database import SessionLocal, engine, Base
import models

Base.metadata.create_all(bind=engine)

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
    # Floor 1 - Ground Floor
    dict(id="F1-001", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  status="available"),
    dict(id="F1-002", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  status="blocked",  blocked_until="2026-03-28 14:00"),
    dict(id="F1-003", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",       status="available"),
    dict(id="F1-004", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",       status="available"),
    dict(id="F1-005", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",       status="blocked",  blocked_until="2026-03-29 10:00"),
    dict(id="F1-006", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  status="available"),
    # Floor 2 - Level 1
    dict(id="F2-001", floor="F2", floor_label="F2 - Level 1", owner="David Wilson",   status="available"),
    dict(id="F2-002", floor="F2", floor_label="F2 - Level 1", owner="David Wilson",   status="available"),
    dict(id="F2-003", floor="F2", floor_label="F2 - Level 1", owner="Lisa Anderson",  status="blocked",  blocked_until="2026-03-28 09:30"),
    dict(id="F2-004", floor="F2", floor_label="F2 - Level 1", owner="James Taylor",   status="available"),
    dict(id="F2-005", floor="F2", floor_label="F2 - Level 1", owner="James Taylor",   status="blocked",  blocked_until="2026-03-30 18:00"),
    # Floor 3 - Level 2
    dict(id="F3-001", floor="F3", floor_label="F3 - Level 2", owner="Patricia Brown", status="available"),
    dict(id="F3-002", floor="F3", floor_label="F3 - Level 2", owner="Robert Garcia",  status="available"),
    dict(id="F3-003", floor="F3", floor_label="F3 - Level 2", owner="Robert Garcia",  status="available"),
    dict(id="F3-004", floor="F3", floor_label="F3 - Level 2", owner="Jennifer Lee",   status="blocked",  blocked_until="2026-03-28 16:30"),
    dict(id="F3-005", floor="F3", floor_label="F3 - Level 2", owner="Jennifer Lee",   status="blocked",  blocked_until="2026-03-29 11:00"),
    dict(id="F3-006", floor="F3", floor_label="F3 - Level 2", owner=None,             status="unowned"),
]


def seed():
    db = SessionLocal()
    try:
        # Clear existing data
        db.query(models.ParkingRequest).delete()
        db.query(models.Lot).delete()
        db.commit()

        # Insert requests
        all_requests = PENDING_REQUESTS + APPROVED_REQUESTS + REJECTED_REQUESTS
        for r in all_requests:
            db.add(models.ParkingRequest(**r))

        # Insert lots
        for l in LOTS:
            db.add(models.Lot(**l))

        db.commit()
        print(f"OK: Seeded {len(all_requests)} requests and {len(LOTS)} lots.")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
