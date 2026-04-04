"""
Seed the SQLite database with sample users, requests and lots.
Run once: python seed.py
Safe to re-run — clears existing data first.

Dates are computed relative to today so the seed stays fresh.
"""

from datetime import datetime, timezone, date, timedelta
from database import SessionLocal, engine, Base
from auth import hash_password
import models

Base.metadata.create_all(bind=engine)

# ── Date helpers ──────────────────────────────────────────────────────────────

_TODAY = date.today()


def _fd(days: int) -> str:
    """Future date string: today + N days."""
    return (_TODAY + timedelta(days=days)).isoformat()


def _ts(days_ago: int, hour: int = 10, minute: int = 0) -> str:
    """ISO timestamp N days ago at the given UTC hour:minute."""
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


def _blocked_until(days: int, hour: int = 10) -> str:
    """Readable datetime string for lot.blocked_until."""
    return f"{_fd(days)} {hour:02d}:00"


# ── Sample users ──────────────────────────────────────────────────────────────
# Passwords are all "password123" for development convenience.
# role is set directly on the model (seed bypasses the /auth/register API which
# forces role="user"; owners/managers are set up here as a privileged operation).
USERS = [
    dict(id="owner-001", name="Sarah Johnson",   email="sarah@parking.dev",       role="owner"),
    dict(id="owner-002", name="Mike Chen",        email="mike@parking.dev",        role="owner"),
    dict(id="owner-003", name="David Wilson",     email="david@parking.dev",       role="owner"),
    dict(id="owner-004", name="Lisa Anderson",    email="lisa@parking.dev",        role="owner"),
    dict(id="owner-005", name="James Taylor",     email="james@parking.dev",       role="owner"),
    dict(id="owner-006", name="Patricia Brown",   email="patricia@parking.dev",    role="owner"),
    dict(id="owner-007", name="Robert Garcia",    email="robert@parking.dev",      role="owner"),
    dict(id="owner-008", name="Jennifer Lee",     email="jennifer@parking.dev",    role="owner"),
    dict(id="user-001",  name="Alice Johnson",    email="alice@parking.dev",       role="user"),
    dict(id="user-002",  name="Bob Smith",        email="bob@parking.dev",         role="user"),
    dict(id="user-003",  name="Carol Williams",   email="carol@parking.dev",       role="user"),
    dict(id="user-004",  name="Emma Brown",       email="emma@parking.dev",        role="user"),
    dict(id="user-005",  name="Frank Davis",      email="frank@parking.dev",       role="user"),
    dict(id="user-006",  name="George Miller",    email="george@parking.dev",      role="user"),
    dict(id="user-007",  name="Helen Garcia",     email="helen@parking.dev",       role="user"),
    dict(id="user-008",  name="Tom Harris",       email="tom@parking.dev",         role="user"),
    dict(id="user-009",  name="Nina Patel",       email="nina@parking.dev",        role="user"),
    dict(id="user-010",  name="David Lee",        email="davidlee@parking.dev",    role="user"),
    dict(id="user-011",  name="Maria Garcia",     email="maria@parking.dev",       role="user"),
    dict(id="user-012",  name="James Wilson",     email="jameswilson@parking.dev", role="user"),
    dict(id="manager-001", name="Admin Manager",  email="admin@parking.dev",       role="manager"),
]

# ── Approved requests ─────────────────────────────────────────────────────────
# approved_by = owner name for manual approvals; "auto" for scheduler approvals.
# Parking dates are all in the future so they appear on the calendar.
APPROVED_REQUESTS = [
    dict(
        id="REQ-001",
        requester_id="user-001",  requester_name="Alice Johnson",
        date=_fd(3),  start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(8, hour=14, minute=30),
        status="approved",
        lot_id="F2-003", floor="F2 - Level 1",      lot_owner="Lisa Anderson",
        approved_at=_ts(7, hour=9, minute=0),
        approved_by="Lisa Anderson",
    ),
    dict(
        id="REQ-002",
        requester_id="user-002",  requester_name="Bob Smith",
        date=_fd(3),  start_time="13:00", end_time="15:00", duration=2,
        submitted_at=_ts(8, hour=9, minute=45),
        status="approved",
        lot_id="F1-002", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(7, hour=10, minute=15),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-003",
        requester_id="user-003",  requester_name="Carol Williams",
        date=_fd(5),  start_time="10:00", end_time="13:00", duration=3,
        submitted_at=_ts(7, hour=10, minute=0),
        status="approved",
        lot_id="F3-005", floor="F3 - Level 2",      lot_owner="Jennifer Lee",
        approved_at=_ts(6, hour=11, minute=30),
        approved_by="Jennifer Lee",
    ),
    dict(
        id="REQ-004",
        requester_id="user-005",  requester_name="Frank Davis",
        date=_fd(6),  start_time="15:00", end_time="18:00", duration=3,
        submitted_at=_ts(7, hour=13, minute=15),
        status="approved",
        lot_id="F2-001", floor="F2 - Level 1",      lot_owner="David Wilson",
        approved_at=_ts(5, hour=14, minute=20),
        approved_by="auto",   # ← auto-approved by scheduler (exercises the badge)
    ),
    dict(
        id="REQ-005",
        requester_id="user-004",  requester_name="Emma Brown",
        date=_fd(3),  start_time="08:00", end_time="12:00", duration=4,
        submitted_at=_ts(8, hour=15, minute=30),
        status="approved",
        lot_id="F1-004", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(7, hour=16, minute=0),
        approved_by="Mike Chen",
    ),
    dict(
        id="REQ-006",
        requester_id="user-006",  requester_name="George Miller",
        date=_fd(4),  start_time="14:00", end_time="17:00", duration=3,
        submitted_at=_ts(7, hour=9, minute=0),
        status="approved",
        lot_id="F3-001", floor="F3 - Level 2",      lot_owner="Patricia Brown",
        approved_at=_ts(6, hour=9, minute=45),
        approved_by="Patricia Brown",
    ),
    dict(
        id="REQ-007",
        requester_id="user-007",  requester_name="Helen Garcia",
        date=_fd(5),  start_time="11:00", end_time="13:00", duration=2,
        submitted_at=_ts(6, hour=11, minute=45),
        status="approved",
        lot_id="F2-004", floor="F2 - Level 1",      lot_owner="James Taylor",
        approved_at=_ts(5, hour=12, minute=30),
        approved_by="James Taylor",
    ),
    dict(
        id="REQ-008",
        requester_id="user-008",  requester_name="Tom Harris",
        date=_fd(5),  start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(5, hour=8, minute=0),
        status="approved",
        lot_id="F1-003", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(4, hour=8, minute=30),
        approved_by="Mike Chen",
    ),
    dict(
        id="REQ-009",
        requester_id="user-009",  requester_name="Nina Patel",
        date=_fd(7),  start_time="14:00", end_time="17:00", duration=3,
        submitted_at=_ts(5, hour=10, minute=30),
        status="approved",
        lot_id="F1-006", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(4, hour=11, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-010",
        requester_id="owner-001", requester_name="Sarah Johnson",
        date=_fd(4),  start_time="14:00", end_time="16:00", duration=2,
        submitted_at=_ts(6, hour=10, minute=0),
        status="approved",
        lot_id="F3-003", floor="F3 - Level 2",      lot_owner="Robert Garcia",
        approved_at=_ts(5, hour=11, minute=0),
        approved_by="Robert Garcia",
    ),
    dict(
        id="REQ-011",
        requester_id="user-012", requester_name="James Wilson",
        date=_fd(4),  start_time="16:00", end_time="18:00", duration=2,
        submitted_at=_ts(3, hour=12, minute=0),
        status="approved",
        lot_id="F1-001", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(2, hour=13, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-025",
        requester_id="user-010", requester_name="David Lee",
        date=_fd(8), start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(3, hour=10, minute=0),
        status="approved",
        lot_id="F2-002", floor="F2 - Level 1", lot_owner="David Wilson",
        approved_at=_ts(2, hour=11, minute=0),
        approved_by="David Wilson",
    ),
    dict(
        id="REQ-026",
        requester_id="user-011", requester_name="Maria Garcia",
        date=_fd(9), start_time="12:00", end_time="14:00", duration=2,
        submitted_at=_ts(4, hour=14, minute=0),
        status="approved",
        lot_id="F1-002", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(3, hour=15, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-027",
        requester_id="user-001", requester_name="Alice Johnson",
        date=_fd(10), start_time="15:00", end_time="18:00", duration=3,
        submitted_at=_ts(2, hour=16, minute=0),
        status="approved",
        lot_id="F3-002", floor="F3 - Level 2", lot_owner="Robert Garcia",
        approved_at=_ts(2, hour=17, minute=0),
        approved_by="Robert Garcia",
    ),
    dict(
        id="REQ-028",
        requester_id="user-002", requester_name="Bob Smith",
        date=_fd(11), start_time="10:00", end_time="11:00", duration=1,
        submitted_at=_ts(1, hour=9, minute=0),
        status="approved",
        lot_id="F1-003", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(1, hour=10, minute=0),
        approved_by="Mike Chen",
    ),

    # ── This week: Monday (day -4) ─────────────────────────────────────────────
    dict(
        id="REQ-W01",
        requester_id="user-001", requester_name="Alice Johnson",
        date=_fd(-4), start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(7, hour=8, minute=0),
        status="approved",
        lot_id="F1-001", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(6, hour=9, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-W02",
        requester_id="user-002", requester_name="Bob Smith",
        date=_fd(-4), start_time="13:00", end_time="15:00", duration=2,
        submitted_at=_ts(7, hour=9, minute=0),
        status="approved",
        lot_id="F2-001", floor="F2 - Level 1", lot_owner="David Wilson",
        approved_at=_ts(6, hour=10, minute=0),
        approved_by="David Wilson",
    ),
    dict(
        id="REQ-W03",
        requester_id="user-003", requester_name="Carol Williams",
        date=_fd(-4), start_time="08:00", end_time="12:00", duration=4,
        submitted_at=_ts(7, hour=10, minute=0),
        status="approved",
        lot_id="F3-001", floor="F3 - Level 2", lot_owner="Patricia Brown",
        approved_at=_ts(6, hour=11, minute=0),
        approved_by="Patricia Brown",
    ),
    dict(
        id="REQ-W04",
        requester_id="user-004", requester_name="Emma Brown",
        date=_fd(-4), start_time="15:00", end_time="18:00", duration=3,
        submitted_at=_ts(7, hour=11, minute=0),
        status="approved",
        lot_id="F1-004", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(6, hour=12, minute=0),
        approved_by="Mike Chen",
    ),

    # ── This week: Tuesday (day -3) ────────────────────────────────────────────
    dict(
        id="REQ-W05",
        requester_id="user-005", requester_name="Frank Davis",
        date=_fd(-3), start_time="09:00", end_time="12:00", duration=3,
        submitted_at=_ts(6, hour=8, minute=30),
        status="approved",
        lot_id="F2-002", floor="F2 - Level 1", lot_owner="David Wilson",
        approved_at=_ts(5, hour=9, minute=0),
        approved_by="David Wilson",
    ),
    dict(
        id="REQ-W06",
        requester_id="user-006", requester_name="George Miller",
        date=_fd(-3), start_time="10:00", end_time="13:00", duration=3,
        submitted_at=_ts(6, hour=9, minute=0),
        status="approved",
        lot_id="F3-002", floor="F3 - Level 2", lot_owner="Robert Garcia",
        approved_at=_ts(5, hour=10, minute=0),
        approved_by="Robert Garcia",
    ),
    dict(
        id="REQ-W07",
        requester_id="user-007", requester_name="Helen Garcia",
        date=_fd(-3), start_time="14:00", end_time="17:00", duration=3,
        submitted_at=_ts(6, hour=10, minute=0),
        status="approved",
        lot_id="F1-006", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(5, hour=11, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-W08",
        requester_id="user-008", requester_name="Tom Harris",
        date=_fd(-3), start_time="08:00", end_time="10:00", duration=2,
        submitted_at=_ts(6, hour=11, minute=0),
        status="approved",
        lot_id="F2-004", floor="F2 - Level 1", lot_owner="James Taylor",
        approved_at=_ts(5, hour=12, minute=0),
        approved_by="James Taylor",
    ),

    # ── This week: Wednesday (day -2) ──────────────────────────────────────────
    dict(
        id="REQ-W09",
        requester_id="user-009", requester_name="Nina Patel",
        date=_fd(-2), start_time="10:00", end_time="12:00", duration=2,
        submitted_at=_ts(5, hour=8, minute=0),
        status="approved",
        lot_id="F3-003", floor="F3 - Level 2", lot_owner="Robert Garcia",
        approved_at=_ts(4, hour=9, minute=0),
        approved_by="Robert Garcia",
    ),
    dict(
        id="REQ-W10",
        requester_id="user-010", requester_name="David Lee",
        date=_fd(-2), start_time="13:00", end_time="16:00", duration=3,
        submitted_at=_ts(5, hour=9, minute=0),
        status="approved",
        lot_id="F1-003", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(4, hour=10, minute=0),
        approved_by="Mike Chen",
    ),
    dict(
        id="REQ-W11",
        requester_id="user-011", requester_name="Maria Garcia",
        date=_fd(-2), start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(5, hour=10, minute=0),
        status="approved",
        lot_id="F2-001", floor="F2 - Level 1", lot_owner="David Wilson",
        approved_at=_ts(4, hour=11, minute=0),
        approved_by="David Wilson",
    ),
    dict(
        id="REQ-W12",
        requester_id="user-012", requester_name="James Wilson",
        date=_fd(-2), start_time="15:00", end_time="18:00", duration=3,
        submitted_at=_ts(5, hour=11, minute=0),
        status="approved",
        lot_id="F3-001", floor="F3 - Level 2", lot_owner="Patricia Brown",
        approved_at=_ts(4, hour=12, minute=0),
        approved_by="Patricia Brown",
    ),

    # ── This week: Thursday (day -1) ───────────────────────────────────────────
    dict(
        id="REQ-W13",
        requester_id="user-001", requester_name="Alice Johnson",
        date=_fd(-1), start_time="08:00", end_time="11:00", duration=3,
        submitted_at=_ts(4, hour=7, minute=30),
        status="approved",
        lot_id="F1-001", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(3, hour=8, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-W14",
        requester_id="user-003", requester_name="Carol Williams",
        date=_fd(-1), start_time="12:00", end_time="15:00", duration=3,
        submitted_at=_ts(4, hour=9, minute=0),
        status="approved",
        lot_id="F3-005", floor="F3 - Level 2", lot_owner="Jennifer Lee",
        approved_at=_ts(3, hour=10, minute=0),
        approved_by="Jennifer Lee",
    ),
    dict(
        id="REQ-W15",
        requester_id="user-005", requester_name="Frank Davis",
        date=_fd(-1), start_time="14:00", end_time="17:00", duration=3,
        submitted_at=_ts(4, hour=10, minute=0),
        status="approved",
        lot_id="F2-002", floor="F2 - Level 1", lot_owner="David Wilson",
        approved_at=_ts(3, hour=11, minute=0),
        approved_by="David Wilson",
    ),
    dict(
        id="REQ-W16",
        requester_id="user-007", requester_name="Helen Garcia",
        date=_fd(-1), start_time="09:00", end_time="13:00", duration=4,
        submitted_at=_ts(4, hour=11, minute=0),
        status="approved",
        lot_id="F2-004", floor="F2 - Level 1", lot_owner="James Taylor",
        approved_at=_ts(3, hour=12, minute=0),
        approved_by="James Taylor",
    ),
    dict(
        id="REQ-101",
        requester_id="user-001", requester_name="Alice Johnson",
        date=_fd(0), start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(2, hour=8, minute=0),
        status="approved",
        lot_id="F1-001", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(1, hour=9, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-102",
        requester_id="user-002", requester_name="Bob Smith",
        date=_fd(0), start_time="10:00", end_time="13:00", duration=3,
        submitted_at=_ts(2, hour=8, minute=30),
        status="approved",
        lot_id="F1-003", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(1, hour=10, minute=0),
        approved_by="Mike Chen",
    ),
    dict(
        id="REQ-103",
        requester_id="user-003", requester_name="Carol Williams",
        date=_fd(0), start_time="12:00", end_time="16:00", duration=4,
        submitted_at=_ts(2, hour=9, minute=0),
        status="approved",
        lot_id="F1-004", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(1, hour=11, minute=0),
        approved_by="Mike Chen",
    ),
    dict(
        id="REQ-104",
        requester_id="user-004", requester_name="Emma Brown",
        date=_fd(0), start_time="08:00", end_time="10:00", duration=2,
        submitted_at=_ts(2, hour=9, minute=30),
        status="approved",
        lot_id="F2-001", floor="F2 - Level 1", lot_owner="David Wilson",
        approved_at=_ts(1, hour=12, minute=0),
        approved_by="David Wilson",
    ),
    dict(
        id="REQ-105",
        requester_id="user-005", requester_name="Frank Davis",
        date=_fd(0), start_time="14:00", end_time="18:00", duration=4,
        submitted_at=_ts(2, hour=10, minute=0),
        status="approved",
        lot_id="F2-002", floor="F2 - Level 1", lot_owner="David Wilson",
        approved_at=_ts(1, hour=13, minute=0),
        approved_by="David Wilson",
    ),
    dict(
        id="REQ-106",
        requester_id="user-006", requester_name="George Miller",
        date=_fd(1), start_time="09:00", end_time="12:00", duration=3,
        submitted_at=_ts(2, hour=11, minute=0),
        status="approved",
        lot_id="F3-001", floor="F3 - Level 2", lot_owner="Patricia Brown",
        approved_at=_ts(1, hour=14, minute=0),
        approved_by="Patricia Brown",
    ),
    dict(
        id="REQ-107",
        requester_id="user-007", requester_name="Helen Garcia",
        date=_fd(1), start_time="13:00", end_time="15:00", duration=2,
        submitted_at=_ts(2, hour=12, minute=0),
        status="approved",
        lot_id="F3-002", floor="F3 - Level 2", lot_owner="Robert Garcia",
        approved_at=_ts(1, hour=15, minute=0),
        approved_by="Robert Garcia",
    ),
    dict(
        id="REQ-108",
        requester_id="user-008", requester_name="Tom Harris",
        date=_fd(1), start_time="08:00", end_time="14:00", duration=6,
        submitted_at=_ts(2, hour=13, minute=0),
        status="approved",
        lot_id="F1-006", floor="F1 - Ground Floor", lot_owner="Sarah Johnson",
        approved_at=_ts(1, hour=16, minute=0),
        approved_by="Sarah Johnson",
    ),
    dict(
        id="REQ-109",
        requester_id="user-009", requester_name="Nina Patel",
        date=_fd(1), start_time="15:00", end_time="18:00", duration=3,
        submitted_at=_ts(2, hour=14, minute=0),
        status="approved",
        lot_id="F2-004", floor="F2 - Level 1", lot_owner="James Taylor",
        approved_at=_ts(1, hour=17, minute=0),
        approved_by="James Taylor",
    ),
    dict(
        id="REQ-110",
        requester_id="user-010", requester_name="David Lee",
        date=_fd(1), start_time="16:00", end_time="18:00", duration=2,
        submitted_at=_ts(2, hour=15, minute=0),
        status="approved",
        lot_id="F1-003", floor="F1 - Ground Floor", lot_owner="Mike Chen",
        approved_at=_ts(1, hour=18, minute=0),
        approved_by="Mike Chen",
    ),
]

# ── Pending requests ──────────────────────────────────────────────────────────
PENDING_REQUESTS = [
    dict(
        id="REQ-012",
        requester_id="user-001",  requester_name="Alice Johnson",
        date=_fd(8),  start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(2, hour=14, minute=30),
        status="pending",
    ),
    dict(
        id="REQ-013",
        requester_id="user-002",  requester_name="Bob Smith",
        date=_fd(9),  start_time="13:00", end_time="15:00", duration=2,
        submitted_at=_ts(2, hour=15, minute=45),
        status="pending",
    ),
    dict(
        id="REQ-014",
        requester_id="user-003",  requester_name="Carol Williams",
        date=_fd(9),  start_time="10:00", end_time="13:00", duration=3,
        submitted_at=_ts(2, hour=16, minute=0),
        status="pending",
        rejected_by_owner=True,
    ),
    dict(
        id="REQ-015",
        requester_id="owner-001", requester_name="Sarah Johnson",
        date=_fd(10), start_time="14:00", end_time="17:00", duration=3,
        submitted_at=_ts(1, hour=16, minute=30),
        status="pending",
    ),
    dict(
        id="REQ-016",
        requester_id="user-004",  requester_name="Emma Brown",
        date=_fd(10), start_time="08:00", end_time="12:00", duration=4,
        submitted_at=_ts(1, hour=9, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-017",
        requester_id="user-005",  requester_name="Frank Davis",
        date=_fd(11), start_time="15:00", end_time="18:00", duration=3,
        submitted_at=_ts(1, hour=10, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-018",
        requester_id="user-010", requester_name="David Lee",
        date=_fd(8),  start_time="17:00", end_time="19:00", duration=2,
        submitted_at=_ts(1, hour=14, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-019",
        requester_id="user-011", requester_name="Maria Garcia",
        date=_fd(8),  start_time="11:00", end_time="13:00", duration=2,
        submitted_at=_ts(0, hour=15, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-021",
        requester_id="user-006", requester_name="George Miller",
        date=_fd(12), start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(2, hour=10, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-022",
        requester_id="user-007", requester_name="Helen Garcia",
        date=_fd(12), start_time="11:00", end_time="15:00", duration=4,
        submitted_at=_ts(2, hour=11, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-023",
        requester_id="user-008", requester_name="Tom Harris",
        date=_fd(13), start_time="14:00", end_time="17:00", duration=3,
        submitted_at=_ts(1, hour=9, minute=30),
        status="pending",
    ),
    dict(
        id="REQ-024",
        requester_id="user-009", requester_name="Nina Patel",
        date=_fd(14), start_time="08:00", end_time="14:00", duration=6,
        submitted_at=_ts(0, hour=8, minute=15),
        status="pending",
    ),
    dict(
        id="REQ-111",
        requester_id="user-001", requester_name="Alice Johnson",
        date=_fd(0), start_time="08:00", end_time="12:00", duration=4,
        submitted_at=_ts(1, hour=9, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-112",
        requester_id="owner-001", requester_name="Sarah Johnson",
        date=_fd(0), start_time="10:00", end_time="13:00", duration=3,
        submitted_at=_ts(1, hour=10, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-113",
        requester_id="user-002", requester_name="Bob Smith",
        date=_fd(0), start_time="14:00", end_time="16:00", duration=2,
        submitted_at=_ts(1, hour=11, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-114",
        requester_id="manager-001", requester_name="Admin Manager",
        date=_fd(0), start_time="09:00", end_time="11:00", duration=2,
        submitted_at=_ts(1, hour=8, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-115",
        requester_id="user-003", requester_name="Carol Williams",
        date=_fd(0), start_time="15:00", end_time="18:00", duration=3,
        submitted_at=_ts(1, hour=12, minute=0),
        status="pending",
    ),

    # ── Tomorrow (day +1) ──────────────────────────────────────────────────────
    dict(
        id="REQ-T01",
        requester_id="user-004", requester_name="Emma Brown",
        date=_fd(1), start_time="08:00", end_time="10:00", duration=2,
        submitted_at=_ts(0, hour=8, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-T02",
        requester_id="user-005", requester_name="Frank Davis",
        date=_fd(1), start_time="10:00", end_time="13:00", duration=3,
        submitted_at=_ts(0, hour=9, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-T03",
        requester_id="user-006", requester_name="George Miller",
        date=_fd(1), start_time="11:00", end_time="14:00", duration=3,
        submitted_at=_ts(0, hour=10, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-T04",
        requester_id="user-009", requester_name="Nina Patel",
        date=_fd(1), start_time="14:00", end_time="16:00", duration=2,
        submitted_at=_ts(0, hour=11, minute=0),
        status="pending",
    ),
    dict(
        id="REQ-T05",
        requester_id="user-012", requester_name="James Wilson",
        date=_fd(1), start_time="16:00", end_time="19:00", duration=3,
        submitted_at=_ts(0, hour=12, minute=0),
        status="pending",
    ),
]

# ── Rejected requests ─────────────────────────────────────────────────────────
REJECTED_REQUESTS = [
    dict(
        id="REQ-020",
        requester_id="owner-001", requester_name="Sarah Johnson",
        date=_fd(14), start_time="10:00", end_time="12:00", duration=2,
        submitted_at=_ts(5, hour=12, minute=0),
        status="rejected",
        lot_id="F2-001", floor="F2 - Level 1", lot_owner="David Wilson",
    ),
    dict(
        id="REQ-029",
        requester_id="user-003",  requester_name="Carol Williams",
        date=_fd(15), start_time="08:00", end_time="12:00", duration=4,
        submitted_at=_ts(3, hour=8, minute=0),
        status="rejected",
        lot_id="F2-004", floor="F2 - Level 1", lot_owner="James Taylor",
        rejected_by_owner=True,
    ),
    dict(
        id="REQ-030",
        requester_id="user-004",  requester_name="Emma Brown",
        date=_fd(16), start_time="14:00", end_time="17:00", duration=3,
        submitted_at=_ts(2, hour=13, minute=0),
        status="rejected",
        lot_id="F3-001", floor="F3 - Level 2", lot_owner="Patricia Brown",
        rejected_by_owner=True,
    ),
]

LOTS = [
    dict(id="F1-001", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  owner_id="owner-001", status="available"),
    dict(id="F1-002", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  owner_id="owner-001", status="blocked",  blocked_until=_blocked_until(6,  hour=14)),
    dict(id="F1-003", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",      owner_id="owner-002", status="available"),
    dict(id="F1-004", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",      owner_id="owner-002", status="available"),
    dict(id="F1-005", floor="F1", floor_label="F1 - Ground Floor", owner="Mike Chen",      owner_id="owner-002", status="blocked",  blocked_until=_blocked_until(7,  hour=10)),
    dict(id="F1-006", floor="F1", floor_label="F1 - Ground Floor", owner="Sarah Johnson",  owner_id="owner-001", status="available"),
    dict(id="F2-001", floor="F2", floor_label="F2 - Level 1",      owner="David Wilson",   owner_id="owner-003", status="available"),
    dict(id="F2-002", floor="F2", floor_label="F2 - Level 1",      owner="David Wilson",   owner_id="owner-003", status="available"),
    dict(id="F2-003", floor="F2", floor_label="F2 - Level 1",      owner="Lisa Anderson",  owner_id="owner-004", status="blocked",  blocked_until=_blocked_until(5,  hour=9)),
    dict(id="F2-004", floor="F2", floor_label="F2 - Level 1",      owner="James Taylor",   owner_id="owner-005", status="available"),
    dict(id="F2-005", floor="F2", floor_label="F2 - Level 1",      owner="James Taylor",   owner_id="owner-005", status="blocked",  blocked_until=_blocked_until(10, hour=18)),
    dict(id="F3-001", floor="F3", floor_label="F3 - Level 2",      owner="Patricia Brown", owner_id="owner-006", status="available"),
    dict(id="F3-002", floor="F3", floor_label="F3 - Level 2",      owner="Robert Garcia",  owner_id="owner-007", status="available"),
    dict(id="F3-003", floor="F3", floor_label="F3 - Level 2",      owner="Robert Garcia",  owner_id="owner-007", status="available"),
    dict(id="F3-004", floor="F3", floor_label="F3 - Level 2",      owner="Jennifer Lee",   owner_id="owner-008", status="blocked",  blocked_until=_blocked_until(6,  hour=16)),
    dict(id="F3-005", floor="F3", floor_label="F3 - Level 2",      owner="Jennifer Lee",   owner_id="owner-008", status="blocked",  blocked_until=_blocked_until(9,  hour=11)),
    dict(id="F3-006", floor="F3", floor_label="F3 - Level 2",      owner=None,             owner_id=None,        status="unowned"),
]


def seed():
    db = SessionLocal()
    try:
        db.query(models.UserPreferences).delete()
        db.query(models.ParkingRequest).delete()
        db.query(models.Lot).delete()
        db.query(models.User).delete()
        db.commit()

        now = datetime.now(timezone.utc).isoformat()

        for u in USERS:
            db.add(models.User(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                password_hash=hash_password("password123"),
                role=u["role"],
                created_at=now,
            ))
            db.add(models.UserPreferences(user_id=u["id"]))

        all_requests = APPROVED_REQUESTS + PENDING_REQUESTS + REJECTED_REQUESTS
        for r in all_requests:
            updated_at = r.get("approved_at") or r["submitted_at"]
            db.add(models.ParkingRequest(**r, updated_at=updated_at))

        for lot in LOTS:
            db.add(models.Lot(**lot, created_at=now, updated_at=now))

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
