from fastapi import APIRouter, Depends
import models
from auth import get_current_user

router = APIRouter(prefix="/api/config", tags=["config"])

# These constants mirror the validation rules enforced in schemas.py
_SYSTEM_CONFIG = {
    "timezone": "UTC+0 (Server time)",
    "blackout_start": "22:00",
    "blackout_end": "06:00",
    "max_active_requests_per_user": 3,
    "booking_window_start": "08:00",
    "booking_window_end": "20:00",
}


@router.get("")
def get_config(current_user: models.User = Depends(get_current_user)):
    """Return read-only system configuration constants. Any authenticated user."""
    return _SYSTEM_CONFIG
