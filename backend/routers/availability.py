from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user, require_owner

router = APIRouter(prefix="/api/lots", tags=["availability"])


def _assert_lot_access(lot_id: str, current_user: models.User, db: Session) -> models.Lot:
    """Return the lot if the caller may manage its availability, else raise 403/404."""
    lot = db.query(models.Lot).filter(models.Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    is_manager = current_user.role == models.UserRole.MANAGER.value
    is_owner = current_user.role == models.UserRole.OWNER.value and lot.owner_id == current_user.id
    if not is_manager and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorised to manage this lot's availability")
    return lot


@router.get("/{lot_id}/availability", response_model=List[schemas.LotAvailabilityWindowOut])
def list_windows(
    lot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List availability windows for a lot. Any authenticated user may read (for the request-form hint)."""
    if not db.query(models.Lot).filter(models.Lot.id == lot_id).first():
        raise HTTPException(status_code=404, detail="Lot not found")
    return (
        db.query(models.LotAvailabilityWindow)
        .filter(models.LotAvailabilityWindow.lot_id == lot_id)
        .order_by(models.LotAvailabilityWindow.day_of_week, models.LotAvailabilityWindow.specific_date)
        .all()
    )


@router.post("/{lot_id}/availability", response_model=schemas.LotAvailabilityWindowOut, status_code=201)
def create_window(
    lot_id: str,
    payload: schemas.LotAvailabilityWindowCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    """Create an availability window. Owner (own lot) or Manager."""
    _assert_lot_access(lot_id, current_user, db)
    win = models.LotAvailabilityWindow(
        lot_id=lot_id,
        day_of_week=payload.day_of_week,
        specific_date=payload.specific_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_active=True,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(win)
    db.commit()
    db.refresh(win)
    return win


@router.patch("/{lot_id}/availability/{window_id}", response_model=schemas.LotAvailabilityWindowOut)
def update_window(
    lot_id: str,
    window_id: int,
    payload: schemas.LotAvailabilityWindowUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    """Update (toggle active, change times). Owner (own lot) or Manager."""
    _assert_lot_access(lot_id, current_user, db)
    win = db.query(models.LotAvailabilityWindow).filter(
        models.LotAvailabilityWindow.id == window_id,
        models.LotAvailabilityWindow.lot_id == lot_id,
    ).first()
    if not win:
        raise HTTPException(status_code=404, detail="Availability window not found")
    if payload.start_time is not None:
        win.start_time = payload.start_time
    if payload.end_time is not None:
        win.end_time = payload.end_time
    if payload.is_active is not None:
        win.is_active = payload.is_active
    db.commit()
    db.refresh(win)
    return win


@router.delete("/{lot_id}/availability/{window_id}", status_code=204)
def delete_window(
    lot_id: str,
    window_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    """Delete an availability window. Owner (own lot) or Manager."""
    _assert_lot_access(lot_id, current_user, db)
    win = db.query(models.LotAvailabilityWindow).filter(
        models.LotAvailabilityWindow.id == window_id,
        models.LotAvailabilityWindow.lot_id == lot_id,
    ).first()
    if not win:
        raise HTTPException(status_code=404, detail="Availability window not found")
    db.delete(win)
    db.commit()
