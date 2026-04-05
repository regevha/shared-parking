from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("", response_model=List[schemas.NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List the most recent 50 notifications for the current user."""
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
        .all()
    )

@router.patch("/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif

@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark all unread notifications for the current user as read."""
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"status": "ok"}

@router.post("/broadcast")
def broadcast_alert(
    payload: schemas.BroadcastPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send a notification to a specific audience. Manager only."""
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can broadcast alerts")

    # Determine targets
    query = db.query(models.User.id)
    if payload.audience == "owners":
        query = query.filter(models.User.role == "owner")
    elif payload.audience == "users":
        query = query.filter(models.User.role == "user")
    # "both" or any other value means all users (owners + users)
    
    target_ids = [u.id for u in query.all()]
    
    now = datetime.now(timezone.utc).isoformat()
    for uid in target_ids:
        db.add(models.Notification(
            user_id=uid,
            message=f"📢 {payload.message}",
            created_at=now
        ))
    
    db.commit()
    return {"status": "ok", "delivered_to": len(target_ids)}
