"""
Background scheduler for auto-approval of parking requests.

Runs every 15 minutes. For each pending request (oldest first), checks whether
the requested lot + date + time slot is conflict-free against already-approved
requests. If clear → auto-approves. If conflicted → skips (leaves for manual review).
"""

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timezone

from database import SessionLocal
import models
from routers.requests import _has_conflict

scheduler = BackgroundScheduler()


def run_auto_approval(db=None):
    """
    Process all pending requests oldest-first and auto-approve conflict-free ones.

    Accepts an optional ``db`` session for testability. When ``db`` is None a
    fresh session is opened and closed internally (normal production path).
    """
    close_db = db is None
    if db is None:
        db = SessionLocal()
    try:
        pending = (
            db.query(models.ParkingRequest)
            .filter(models.ParkingRequest.status == "pending")
            .order_by(models.ParkingRequest.submitted_at)
            .all()
        )
        for req in pending:
            if _has_conflict(
                db, req.lot_id, req.date, req.start_time, req.end_time, exclude_id=req.id
            ):
                continue  # conflicted — leave for manual owner review
            now = datetime.now(timezone.utc).isoformat()
            req.status = "approved"
            req.approved_by = "auto"
            req.approved_at = now
            req.updated_at = now
            db.commit()
    finally:
        if close_db:
            db.close()


scheduler.add_job(run_auto_approval, "interval", minutes=15)
