from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
from auth import get_current_user
from database import SessionLocal

router = APIRouter(prefix="/api/config", tags=["config"])

# These constants mirror the validation rules enforced in schemas.py
_SYSTEM_CONFIG = {
    "timezone": "UTC+0 (Server time)",
    "blackout_start": "22:00",
    "blackout_end": "06:00",
    "max_pending_requests_per_user": 5,
}


@router.get("")
def get_config(current_user: models.User = Depends(get_current_user)):
    """Return read-only system configuration constants. Any authenticated user."""
    return _SYSTEM_CONFIG


@router.post("/run-auto-approval")
def trigger_auto_approval(current_user: models.User = Depends(get_current_user)):
    """Manually trigger the auto-approval scheduler job. Manager only."""
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager role required")

    from scheduler import run_auto_approval

    db: Session = SessionLocal()
    try:
        # Count pending before
        before = db.query(models.ParkingRequest).filter(
            models.ParkingRequest.status == "pending"
        ).count()

        run_auto_approval(db=db)

        after = db.query(models.ParkingRequest).filter(
            models.ParkingRequest.status == "pending"
        ).count()

        approved = before - after
        return {"approved": approved, "remaining_pending": after}
    finally:
        db.close()
