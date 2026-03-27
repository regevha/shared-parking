from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/lots", tags=["lots"])


@router.get("", response_model=List[schemas.LotOut])
def get_all_lots(db: Session = Depends(get_db)):
    return db.query(models.Lot).all()


@router.get("/owner/{owner_name}", response_model=List[schemas.LotOut])
def get_lots_by_owner(owner_name: str, db: Session = Depends(get_db)):
    return (
        db.query(models.Lot)
        .filter(models.Lot.owner == owner_name)
        .all()
    )


@router.get("/{lot_id}", response_model=schemas.LotOut)
def get_lot(lot_id: str, db: Session = Depends(get_db)):
    lot = db.query(models.Lot).filter(models.Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot
