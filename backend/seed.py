"""
Seed the SQLite database with simplified sample data: 3 Owners, 2 Admins.
"""

from datetime import datetime, timezone, date, timedelta
import json
import models
from database import SessionLocal, engine, Base
from auth import hash_password

Base.metadata.create_all(bind=engine)

_TODAY = date.today()

def _fd(days: int) -> str:
    return (_TODAY + timedelta(days=days)).isoformat()

def _ts(days_ago: int, hour: int = 10, minute: int = 0) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()

# ── 5 Users ───────────────────────────────────────────────────────────────────
USERS = [
    dict(id="O1", name="Owner One",   email="o1@parking.dev", role="owner"),
    dict(id="O2", name="Owner Two",   email="o2@parking.dev", role="owner"),
    dict(id="O3", name="Owner Three", email="o3@parking.dev", role="owner"),
    dict(id="A1", name="Admin One",   email="a1@parking.dev", role="manager"),
    dict(id="A2", name="Admin Two",   email="a2@parking.dev", role="manager"),
]

# ── 3 Lots ────────────────────────────────────────────────────────────────────
LOTS = [
    dict(id="LOT-101-A", floor="F1", floor_label="Floor 1 (A)", owner="Owner One",   owner_id="O1", status="available"),
    dict(id="LOT-101-B", floor="F1", floor_label="Floor 1 (B)", owner="Owner One",   owner_id="O1", status="available"),
    dict(id="LOT-102", floor="F1", floor_label="Floor 1", owner="Owner Two",   owner_id="O2", status="available"),
    dict(id="LOT-201", floor="F2", floor_label="Floor 2", owner="Owner Three", owner_id="O3", status="available"),
]

# ── Sample Requests ───────────────────────────────────────────────────────────
# We define them with duration and let seed() compute end_date/end_time.
REQUESTS = [
    dict(
        id="REQ-001", requester_id="A1", requester_name="Admin One",
        date=_fd(1), start_time="09:00", duration=4, status="approved",
        lot_id="LOT-101-A", floor="Floor 1 (A)", lot_owner="Owner One",
        approved_by="Owner One"
    ),
    dict(
        id="REQ-002", requester_id="O1", requester_name="Owner One",
        date=_fd(2), start_time="18:00", duration=30, status="pending"
    ),
    dict(
        id="REQ-003", requester_id="O2", requester_name="Owner Two",
        date=_fd(1), start_time="10:00", duration=2, status="pending"
    ),
    # 10 More Pending Requests
    dict(id="REQ-P01", requester_id="A1", requester_name="Admin One",   date=_fd(0), start_time="14:00", duration=2,  status="pending"),
    dict(id="REQ-P02", requester_id="A2", requester_name="Admin Two",   date=_fd(0), start_time="16:00", duration=4,  status="pending"),
    dict(id="REQ-P03", requester_id="O3", requester_name="Owner Three", date=_fd(1), start_time="08:00", duration=12, status="pending"),
    dict(id="REQ-P04", requester_id="O1", requester_name="Owner One",   date=_fd(1), start_time="20:00", duration=24, status="pending"), # Multi-day
    dict(id="REQ-P05", requester_id="O2", requester_name="Owner Two",   date=_fd(1), start_time="13:00", duration=8,  status="pending"),
    dict(id="REQ-P06", requester_id="A1", requester_name="Admin One",   date=_fd(2), start_time="09:00", duration=3,  status="pending"),
    dict(id="REQ-P07", requester_id="A2", requester_name="Admin Two",   date=_fd(2), start_time="10:00", duration=36, status="pending"), # Max multi-day
    dict(id="REQ-P08", requester_id="O3", requester_name="Owner Three", date=_fd(2), start_time="18:00", duration=4,  status="pending"),
    dict(id="REQ-P09", requester_id="O1", requester_name="Owner One",   date=_fd(3), start_time="07:00", duration=5,  status="pending"),
    dict(id="REQ-P10", requester_id="O2", requester_name="Owner Two",   date=_fd(3), start_time="12:00", duration=6,  status="pending"),
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
            
            # Clean dictionary for model creation (remove duration from splat if needed, but model has it)
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
        print("Credentials: <o1|o2|o3|a1|a2>@parking.dev / password123")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
