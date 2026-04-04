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
from routers.requests import _has_conflict, _is_outside_availability, _add_audit_log

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
        
        all_lots = db.query(models.Lot).filter(models.Lot.status != "unowned").all()

        for req in pending:
            target_lot = None
            
            # If request already has a lot specified, check only that one
            if req.lot_id:
                lot = next((l for l in all_lots if l.id == req.lot_id), None)
                if lot and lot.status == "available":
                    if not _has_conflict(db, lot.id, req.date, req.start_time, req.end_date, req.end_time, exclude_id=req.id) and \
                       not _is_outside_availability(db, lot.id, req.date, req.start_time, req.end_date, req.end_time):
                        target_lot = lot
            else:
                # Try to find ANY available lot
                for lot in all_lots:
                    if lot.status != "available":
                        continue
                    
                    # Check for conflicts and availability for THIS lot
                    if not _has_conflict(db, lot.id, req.date, req.start_time, req.end_date, req.end_time, exclude_id=req.id) and \
                       not _is_outside_availability(db, lot.id, req.date, req.start_time, req.end_date, req.end_time):
                        target_lot = lot
                        break
            
            if target_lot:
                now = datetime.now(timezone.utc).isoformat()
                req.status = "approved"
                req.approved_by = "auto"
                req.approved_at = now
                req.updated_at = now
                # Assign lot info
                req.lot_id = target_lot.id
                req.floor = target_lot.floor_label
                req.lot_owner = target_lot.owner
                
                _add_audit_log(
                    db, req.id, "system", "Auto Scheduler", "auto-assigned",
                    details=f"Assigned lot {target_lot.id} (Floor {target_lot.floor_label})"
                )
                
                db.commit()
    finally:
        if close_db:
            db.close()


scheduler.add_job(run_auto_approval, "interval", minutes=15)
