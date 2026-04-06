from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
from auth import get_current_user
from database import SessionLocal, get_db

router = APIRouter(prefix="/api/config", tags=["config"])

import os

# These constants mirror the validation rules enforced in schemas.py
def get_system_config():
    return {
        "timezone": os.getenv("TIMEZONE", "UTC+0 (Server time)"),
        "blackout_start": os.getenv("BLACKOUT_START", "22:00"),
        "blackout_end": os.getenv("BLACKOUT_END", "06:00"),
        "max_pending_requests_per_user": int(os.getenv("MAX_PENDING_REQUESTS", 5)),
    }


@router.get("")
def get_config(current_user: models.User = Depends(get_current_user)):
    """Return read-only system configuration constants. Any authenticated user."""
    return get_system_config()


@router.post("/run-auto-approval")
def trigger_auto_approval(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger the auto-approval scheduler job. Manager only."""
    if str(current_user.role) != models.UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Manager role required")

    from scheduler import run_auto_approval

    try:
        # Count pending before
        before = db.query(models.ParkingRequest).filter(
            models.ParkingRequest.status == models.RequestStatus.PENDING.value
        ).count()

        run_auto_approval(db=db)

        after = db.query(models.ParkingRequest).filter(
            models.ParkingRequest.status == models.RequestStatus.PENDING.value
        ).count()

        approved = before - after
        return {"approved": approved, "remaining_pending": after}
    finally:
        db.close()
