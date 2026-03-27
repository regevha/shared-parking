from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user, require_owner

router = APIRouter(prefix="/api/requests", tags=["requests"])


def _generate_id(db: Session) -> str:
    count = db.query(models.ParkingRequest).count()
    return f"REQ-{count + 1:03d}"


@router.get("", response_model=List[schemas.ParkingRequestOut])
def get_all_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.ParkingRequest).all()


@router.get("/pending", response_model=List[schemas.ParkingRequestOut])
def get_pending(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.ParkingRequest)
        .filter(models.ParkingRequest.status == "pending")
        .all()
    )


@router.get("/approved", response_model=List[schemas.ParkingRequestOut])
def get_approved(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.ParkingRequest)
        .filter(models.ParkingRequest.status == "approved")
        .all()
    )


@router.get("/me", response_model=List[schemas.ParkingRequestOut])
def get_my_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns requests submitted by the authenticated user."""
    return (
        db.query(models.ParkingRequest)
        .filter(models.ParkingRequest.requester_id == current_user.id)
        .all()
    )


@router.post("", response_model=schemas.ParkingRequestOut, status_code=201)
def create_request(
    payload: schemas.ParkingRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = models.ParkingRequest(
        id=_generate_id(db),
        requester_id=current_user.id,
        requester_name=current_user.name,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        duration=payload.duration,
        submitted_at=datetime.now(timezone.utc).isoformat(),
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.patch("/{request_id}/approve", response_model=schemas.ParkingRequestOut)
def approve_request(
    request_id: str,
    payload: schemas.ApprovePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be approved")

    req.status = "approved"
    req.approved_at = datetime.now(timezone.utc).isoformat()
    req.rejected_by_owner = False
    if payload.lot_id:
        req.lot_id = payload.lot_id
    if payload.floor:
        req.floor = payload.floor
    if payload.lot_owner:
        req.lot_owner = payload.lot_owner

    db.commit()
    db.refresh(req)
    return req


@router.patch("/{request_id}/reject", response_model=schemas.ParkingRequestOut)
def reject_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "rejected"
    req.rejected_by_owner = True
    db.commit()
    db.refresh(req)
    return req


@router.patch("/{request_id}", response_model=schemas.ParkingRequestOut)
def update_request(
    request_id: str,
    payload: schemas.ParkingRequestUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own requests")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")

    if payload.date is not None:
        req.date = payload.date
    if payload.start_time is not None:
        req.start_time = payload.start_time
    if payload.end_time is not None:
        req.end_time = payload.end_time
    if payload.duration is not None:
        req.duration = payload.duration

    db.commit()
    db.refresh(req)
    return req


@router.delete("/{request_id}", status_code=204)
def delete_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own requests")
    db.delete(req)
    db.commit()
