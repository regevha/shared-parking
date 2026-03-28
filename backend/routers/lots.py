from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user, require_owner, require_manager

router = APIRouter(prefix="/api/lots", tags=["lots"])


@router.get("", response_model=List[schemas.LotOut])
def get_all_lots(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Lot).all()


@router.get("/mine", response_model=List[schemas.LotOut])
def get_my_lots(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    """Returns lots owned by the authenticated owner."""
    return (
        db.query(models.Lot)
        .filter(models.Lot.owner_id == current_user.id)
        .all()
    )


@router.get("/owner/{owner_name}", response_model=List[schemas.LotOut])
def get_lots_by_owner(
    owner_name: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Lot)
        .filter(models.Lot.owner == owner_name)
        .all()
    )


@router.post("", response_model=schemas.LotOut, status_code=201)
def create_lot(
    payload: schemas.LotCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    """Create a new lot. Manager only."""
    if db.query(models.Lot).filter(models.Lot.id == payload.id).first():
        raise HTTPException(status_code=400, detail="Lot ID already exists")
    lot = models.Lot(**payload.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.patch("/{lot_id}", response_model=schemas.LotOut)
def update_lot(
    lot_id: str,
    payload: schemas.LotUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Update lot status/owner/blocked_until.
    - Manager: any lot.
    - Owner: only their own lots (status + blocked_until only).
    """
    lot = db.query(models.Lot).filter(models.Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    is_manager = current_user.role == "manager"
    is_lot_owner = current_user.role == "owner" and lot.owner_id == current_user.id

    if not is_manager and not is_lot_owner:
        raise HTTPException(status_code=403, detail="Not authorised to update this lot")

    # Owners may only change status and blocked_until, not reassign ownership
    if not is_manager and (payload.owner is not None or payload.owner_id is not None):
        raise HTTPException(status_code=403, detail="Only managers can reassign lot ownership")

    if payload.status is not None:
        lot.status = payload.status
    if payload.blocked_until is not None:
        lot.blocked_until = payload.blocked_until
    if is_manager:
        if payload.owner is not None:
            lot.owner = payload.owner
        if payload.owner_id is not None:
            lot.owner_id = payload.owner_id

    db.commit()
    db.refresh(lot)
    return lot


@router.delete("/{lot_id}", status_code=204)
def delete_lot(
    lot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    """Delete a lot. Manager only."""
    lot = db.query(models.Lot).filter(models.Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    db.delete(lot)
    db.commit()


@router.get("/{lot_id}", response_model=schemas.LotOut)
def get_lot(
    lot_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lot = db.query(models.Lot).filter(models.Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot
