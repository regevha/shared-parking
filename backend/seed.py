"""
Seed the SQLite database with sample data:
  2 Users, 3 Owners, 2 Managers — 7 total
  10 Parking Lots across 3 floors (mixed statuses)
  ~37 Parking Requests (approved, rejected, pending)
"""

from datetime import datetime, timezone, date, timedelta
import json
import models
from database import SessionLocal, engine, Base

Base.metadata.create_all(bind=engine)

_TODAY = date.today()

def _fd(days: int) -> str:
    return (_TODAY + timedelta(days=days)).isoformat()

def _ts(days_ago: int, hour: int = 10, minute: int = 0) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()

# ── 7 Users ───────────────────────────────────────────────────────────────────
USERS = [
    dict(id="U1", name="Tom",    email="u1@parking.dev", role="user"),
    dict(id="U2", name="Amy",    email="u2@parking.dev", role="user"),
    dict(id="O1", name="Sarah",  email="o1@parking.dev", role="owner"),
    dict(id="O2", name="Mike",   email="o2@parking.dev", role="owner"),
    dict(id="O3", name="Lisa",   email="o3@parking.dev", role="owner"),
    dict(id="A1", name="David",  email="a1@parking.dev", role="manager"),
    dict(id="A2", name="Emma",   email="a2@parking.dev", role="manager"),
]

# ── 10 Lots (3 floors, mixed statuses) ───────────────────────────────────────
# Sarah: 3 lots, Mike: 3 lots, Lisa: 2 lots, 2 unowned
LOTS = [
    # Floor 1 — 4 lots
    dict(id="LOT-101-A", floor="F1", floor_label="Floor 1 (A)", owner="Sarah", owner_id="O1", status="available"),
    dict(id="LOT-101-B", floor="F1", floor_label="Floor 1 (B)", owner="Sarah", owner_id="O1", status="blocked",
         blocked_until=(_TODAY + timedelta(days=5)).isoformat() + "T18:00:00"),
    dict(id="LOT-102",   floor="F1", floor_label="Floor 1",     owner="Mike",  owner_id="O2", status="available"),
    dict(id="LOT-103",   floor="F1", floor_label="Floor 1 (C)", owner="Mike",  owner_id="O2", status="available"),
    # Floor 2 — 4 lots
    dict(id="LOT-201",   floor="F2", floor_label="Floor 2 (A)", owner="Lisa",  owner_id="O3", status="available"),
    dict(id="LOT-202",   floor="F2", floor_label="Floor 2 (B)", owner="Lisa",  owner_id="O3", status="blocked",
         blocked_until=(_TODAY + timedelta(days=3)).isoformat() + "T12:00:00"),
    dict(id="LOT-203",   floor="F2", floor_label="Floor 2 (C)", owner="Sarah", owner_id="O1", status="available"),
    dict(id="LOT-204",   floor="F2", floor_label="Floor 2 (D)", owner="Mike",  owner_id="O2", status="available"),
    # Floor 3 — 2 unowned lots
    dict(id="LOT-301",   floor="F3", floor_label="Floor 3 (A)", owner=None, owner_id=None, status="unowned"),
    dict(id="LOT-302",   floor="F3", floor_label="Floor 3 (B)", owner=None, owner_id=None, status="unowned-blocked",
         blocked_until=(_TODAY + timedelta(days=10)).isoformat() + "T23:59:00"),
]

# ── Sample Requests ───────────────────────────────────────────────────────────
REQUESTS = [
    # ── Approved (past & future) ─────────────────────────────────────────────
    dict(
        id="REQ-001", requester_id="A1", requester_name="David",
        date=_fd(0), start_time="09:00", duration=4, status="approved",
        lot_id="LOT-101-A", floor="Floor 1 (A)", lot_owner="Sarah",
        approved_by="Sarah"
    ),
    dict(
        id="REQ-A01", requester_id="A2", requester_name="Emma",
        date=_fd(-3), start_time="08:00", duration=3, status="approved",
        lot_id="LOT-102", floor="Floor 1", lot_owner="Mike",
        approved_by="Mike"
    ),
    dict(
        id="REQ-A02", requester_id="U1", requester_name="Tom",
        date=_fd(-2), start_time="10:00", duration=5, status="approved",
        lot_id="LOT-201", floor="Floor 2 (A)", lot_owner="Lisa",
        approved_by="Lisa"
    ),
    dict(
        id="REQ-A03", requester_id="O1", requester_name="Sarah",
        date=_fd(-1), start_time="14:00", duration=2, status="approved",
        lot_id="LOT-203", floor="Floor 2 (C)", lot_owner="Sarah",
        approved_by="Sarah"
    ),
    dict(
        id="REQ-A04", requester_id="U2", requester_name="Amy",
        date=_fd(1), start_time="11:00", duration=3, status="approved",
        lot_id="LOT-103", floor="Floor 1 (C)", lot_owner="Mike",
        approved_by="Mike"
    ),
    dict(
        id="REQ-A05", requester_id="A2", requester_name="Emma",
        date=_fd(1), start_time="14:00", duration=4, status="approved",
        lot_id="LOT-201", floor="Floor 2 (A)", lot_owner="Lisa",
        approved_by="Lisa"
    ),
    dict(
        id="REQ-A06", requester_id="O2", requester_name="Mike",
        date=_fd(2), start_time="09:00", duration=6, status="approved",
        lot_id="LOT-203", floor="Floor 2 (C)", lot_owner="Sarah",
        approved_by="Sarah"
    ),
    dict(
        id="REQ-A07", requester_id="U1", requester_name="Tom",
        date=_fd(2), start_time="08:00", duration=8, status="approved",
        lot_id="LOT-101-A", floor="Floor 1 (A)", lot_owner="Sarah",
        approved_by="Sarah"
    ),
    dict(
        id="REQ-A08", requester_id="A2", requester_name="Emma",
        date=_fd(3), start_time="10:00", duration=3, status="approved",
        lot_id="LOT-102", floor="Floor 1", lot_owner="Mike",
        approved_by="Mike"
    ),
    dict(
        id="REQ-A09", requester_id="U2", requester_name="Amy",
        date=_fd(3), start_time="13:00", duration=5, status="approved",
        lot_id="LOT-204", floor="Floor 2 (D)", lot_owner="Mike",
        approved_by="Mike"
    ),
    dict(
        id="REQ-A10", requester_id="O3", requester_name="Lisa",
        date=_fd(4), start_time="09:00", duration=4, status="approved",
        lot_id="LOT-102", floor="Floor 1", lot_owner="Mike",
        approved_by="Mike"
    ),

    # ── Rejected (with lot info where applicable) ────────────────────────────
    dict(
        id="REQ-R01", requester_id="O2", requester_name="Mike",
        date=_fd(-1), start_time="09:00", duration=4, status="rejected",
        lot_id="LOT-101-A", floor="Floor 1 (A)", lot_owner="Sarah"
    ),
    dict(
        id="REQ-R02", requester_id="U1", requester_name="Tom",
        date=_fd(-2), start_time="11:00", duration=2, status="rejected"
    ),
    dict(
        id="REQ-R03", requester_id="U2", requester_name="Amy",
        date=_fd(1), start_time="16:00", duration=3, status="rejected",
        lot_id="LOT-201", floor="Floor 2 (A)", lot_owner="Lisa"
    ),
    dict(
        id="REQ-R04", requester_id="A2", requester_name="Emma",
        date=_fd(2), start_time="07:00", duration=5, status="rejected"
    ),
    dict(
        id="REQ-R05", requester_id="O3", requester_name="Lisa",
        date=_fd(-3), start_time="14:00", duration=3, status="rejected",
        lot_id="LOT-103", floor="Floor 1 (C)", lot_owner="Mike"
    ),

    # ── Pending ───────────────────────────────────────────────────────────────
    dict(id="REQ-002",  requester_id="U1", requester_name="Tom",   date=_fd(0), start_time="14:00", duration=3,  status="pending"),
    dict(id="REQ-003",  requester_id="U2", requester_name="Amy",   date=_fd(0), start_time="10:00", duration=2,  status="pending"),
    dict(id="REQ-P01",  requester_id="A1", requester_name="David", date=_fd(0), start_time="16:00", duration=2,  status="pending"),
    dict(id="REQ-P02",  requester_id="A2", requester_name="Emma",  date=_fd(0), start_time="18:00", duration=4,  status="pending"),
    dict(id="REQ-P03",  requester_id="U1", requester_name="Tom",   date=_fd(1), start_time="08:00", duration=6,  status="pending"),
    dict(id="REQ-P04",  requester_id="O1", requester_name="Sarah", date=_fd(1), start_time="20:00", duration=24, status="pending"),  # multi-day
    dict(id="REQ-P05",  requester_id="U2", requester_name="Amy",   date=_fd(1), start_time="13:00", duration=4,  status="pending"),
    dict(id="REQ-P06",  requester_id="A1", requester_name="David", date=_fd(2), start_time="09:00", duration=3,  status="pending"),
    dict(id="REQ-P07",  requester_id="U1", requester_name="Tom",   date=_fd(2), start_time="10:00", duration=36, status="pending"),  # max multi-day
    dict(id="REQ-P08",  requester_id="O3", requester_name="Lisa",  date=_fd(2), start_time="18:00", duration=4,  status="pending"),
    dict(id="REQ-P09",  requester_id="U2", requester_name="Amy",   date=_fd(3), start_time="07:00", duration=5,  status="pending"),
    dict(id="REQ-P10",  requester_id="O2", requester_name="Mike",  date=_fd(3), start_time="12:00", duration=6,  status="pending"),
    dict(id="REQ-P11",  requester_id="U1", requester_name="Tom",   date=_fd(4), start_time="09:00", duration=4,  status="pending"),
    dict(id="REQ-P12",  requester_id="A2", requester_name="Emma",  date=_fd(4), start_time="11:00", duration=3,  status="pending"),
    dict(id="REQ-P13",  requester_id="U2", requester_name="Amy",   date=_fd(5), start_time="10:00", duration=2,  status="pending"),
    dict(id="REQ-P14",  requester_id="O1", requester_name="Sarah", date=_fd(5), start_time="15:00", duration=8,  status="pending"),
    dict(id="REQ-P15",  requester_id="O2", requester_name="Mike",  date=_fd(6), start_time="08:00", duration=4,  status="pending"),
]

def seed():
    db = SessionLocal()
    try:
        # Clear existing data
        db.query(models.AuditLog).delete()
        db.query(models.Notification).delete()
        db.query(models.RequestMessage).delete()
        db.query(models.UserPreferences).delete()
        db.query(models.ParkingRequest).delete()
        db.query(models.Lot).delete()
        db.query(models.User).delete()
        db.commit()

        now_iso = datetime.now(timezone.utc).isoformat()
        pw_hash = hash_password("password123")

        # Add Users & Preferences
        for u in USERS:
            db.add(models.User(
                id=u["id"], name=u["name"], email=u["email"],
                password_hash=pw_hash, role=u["role"], created_at=now_iso
            ))

            # Default 24/7 availability for owners
            avail = "{}"
            if u["role"] == "owner":
                avail = json.dumps({
                    day: [{"id": f"w{i}", "startTime": "00:00", "endTime": "23:59"}]
                    for i, day in enumerate(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
                })

            db.add(models.UserPreferences(
                user_id=u["id"],
                availability_windows=avail,
                dark_mode=True,
                language="en"
            ))

        # Add Lots
        for lot in LOTS:
            db.add(models.Lot(**lot, created_at=now_iso, updated_at=now_iso))

        # Add Requests
        for r in REQUESTS:
            start_dt = datetime.strptime(f"{r['date']} {r['start_time']}", "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(hours=r['duration'])

            req_data = r.copy()
            req_data["end_date"] = end_dt.strftime("%Y-%m-%d")
            req_data["end_time"] = end_dt.strftime("%H:%M")
            req_data["submitted_at"] = _ts(1)
            req_data["updated_at"] = now_iso

            # Extract approved_by before popping
            approved_by = req_data.pop("approved_by", None)

            db.add(models.ParkingRequest(**req_data))

            # Add Audit Logs for seed data
            log_sub = models.AuditLog(
                request_id=req_data["id"],
                requester_id=req_data["requester_id"],
                user_id=req_data["requester_id"],
                user_name=req_data["requester_name"],
                action="submitted",
                timestamp=now_iso
            )
            db.add(log_sub)

            if req_data.get("status") == "approved":
                log_app = models.AuditLog(
                    request_id=req_data["id"],
                    requester_id=req_data["requester_id"],
                    user_id="seed",
                    user_name=approved_by or "System",
                    action="approved",
                    details=f"Assigned lot {req_data.get('lot_id')} (Floor {req_data.get('floor')})",
                    timestamp=now_iso
                )
                db.add(log_app)

        db.commit()
        print(f"OK: Seeded {len(USERS)} users, {len(REQUESTS)} requests, {len(LOTS)} lots.")
        print("Credentials: <u1|u2|o1|o2|o3|a1|a2>@parking.dev / password123")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
