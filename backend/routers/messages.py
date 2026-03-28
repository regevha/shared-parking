from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/requests", tags=["messages"])


def _check_access(req: models.ParkingRequest, current_user: models.User) -> None:
    """Allow requester or any owner/manager to read/write messages."""
    if current_user.role in ("owner", "manager"):
        return
    if req.requester_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Access denied")


@router.get("/{request_id}/messages", response_model=List[schemas.MessageOut])
def get_messages(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _check_access(req, current_user)
    return (
        db.query(models.RequestMessage)
        .filter(models.RequestMessage.request_id == request_id)
        .order_by(models.RequestMessage.id)
        .all()
    )


@router.post("/{request_id}/messages", response_model=schemas.MessageOut, status_code=201)
def send_message(
    request_id: str,
    payload: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    _check_access(req, current_user)

    msg = models.RequestMessage(
        request_id=request_id,
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_role=current_user.role,
        text=payload.text,
        sent_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
