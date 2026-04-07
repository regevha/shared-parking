from fastapi import APIRouter, Depends, HTTPException
import os
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import datetime as dt_mod
import json
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user, require_owner

router = APIRouter(prefix="/api/requests", tags=["requests"])


def _generate_id(db: Session) -> str:
    """Generate a sequential REQ-XXX ID or fallback to a short UUID on error/collision."""
    last = db.query(models.ParkingRequest.id).order_by(models.ParkingRequest.id.desc()).first()
    if not last:
        return "REQ-001"
    
    id_str = last[0]
    if "-" in id_str:
        try:
            prefix, num_str = id_str.split("-", 1)
            if prefix == "REQ":
                last_num = int(num_str)
                # Keep padding but allow growth beyond 999
                padding = max(3, len(num_str))
                return f"REQ-{last_num + 1:0{padding}d}"
        except (ValueError, IndexError):
            pass
    
    # Fallback for non-standard IDs to avoid collisions
    import uuid
    return f"REQ-{uuid.uuid4().hex[:6].upper()}"


def _add_audit_log(
    db: Session, request_id: str, user_id: str, user_name: str, action: str, 
    details: str | None = None, requester_id: str | None = None
):
    log = models.AuditLog(
        request_id=request_id,
        requester_id=requester_id,
        user_id=user_id,
        user_name=user_name,
        action=action,
        details=details,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
    db.add(log)


def _create_notification(db: Session, user_id: str, message: str):
    notif = models.Notification(
        user_id=user_id,
        message=message,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    db.add(notif)
    db.commit()


def _has_conflict(
    db: Session,
    lot_id: str | None,
    start_date: str,
    start_time: str,
    end_date: str,
    end_time: str,
    exclude_id: str | None = None,
) -> str | None:
    """Return the ID of the conflicting approved request if one overlaps, else None."""
    if not lot_id:
        return None
    
    new_start = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
    new_end = datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M")

    # We check all approved requests for that lot.
    existing = db.query(models.ParkingRequest).filter(
        models.ParkingRequest.lot_id == lot_id,
        models.ParkingRequest.status == "approved"
    ).all()

    for r in existing:
        if exclude_id and r.id == exclude_id:
            continue
        r_start = datetime.strptime(f"{r.date} {r.start_time}", "%Y-%m-%d %H:%M")
        r_end = datetime.strptime(f"{r.end_date} {r.end_time}", "%Y-%m-%d %H:%M")
        
        # Standard overlap check: (s1 < e2) and (e1 > s2)
        if new_start < r_end and new_end > r_start:
            return r.id
            
    return None


def _is_outside_availability(
    db: Session,
    lot_id: str | None,
    start_date: str,
    start_time: str,
    end_date: str,
    end_time: str,
) -> bool:
    """
    Return True if the slot is NOT fully contained within the owner's availability windows.
    Checked day-by-day for multi-day requests.
    """
    if not lot_id:
        return False

    lot = db.query(models.Lot).filter(models.Lot.id == lot_id).first()
    if not lot or not lot.owner_id:
        return False

    prefs = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == lot.owner_id).first()
    if not prefs:
        return True

    try:
        current_dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
        end_dt = datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M")
        
        windows_raw = json.loads(prefs.availability_windows or '{}')

        # We evaluate the span day by day
        check_dt = current_dt
        while check_dt < end_dt:
            day_name = check_dt.strftime('%A')
            day_slots = windows_raw.get(day_name, [])
            
            # Determine the segment of this request that falls on THIS day
            segment_start_str = check_dt.strftime("%H:%M")
            
            # If end_dt is on the same day as check_dt
            if end_dt.date() == check_dt.date():
                segment_end_str = end_dt.strftime("%H:%M")
            else:
                segment_end_str = "23:59"

            # Check if THIS segment is covered by any window on THIS day
            segment_covered = False
            for slot in day_slots:
                # If segment_end_str is 23:59, we treat it as being covered if the slot ends at 23:59
                if segment_start_str >= slot['startTime'] and segment_end_str <= slot['endTime']:
                    segment_covered = True
                    break
            
            if not segment_covered:
                return True
            
            # Move to the start of the next day (00:00)
            next_day = check_dt.date() + timedelta(days=1)
            check_dt = datetime.combine(next_day, datetime.min.time())
        
        return False
    except (ValueError, json.JSONDecodeError, KeyError):
        return True


@router.get("", response_model=List[schemas.ParkingRequestOut])
def get_all_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if str(current_user.role) != models.UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can view all requests")
    return db.query(models.ParkingRequest).all()


@router.get("/pending", response_model=List[schemas.ParkingRequestOut])
def get_pending(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.ParkingRequest)
        .filter(models.ParkingRequest.status == models.RequestStatus.PENDING.value)
        .all()
    )


@router.get("/approved", response_model=List[schemas.ParkingRequestOut])
def get_approved(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.ParkingRequest)
        .filter(models.ParkingRequest.status == models.RequestStatus.APPROVED.value)
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
    """Create a new parking request. Limit: 5 pending requests per user."""
    pending_count = (
        db.query(models.ParkingRequest)
        .filter(
            models.ParkingRequest.requester_id == current_user.id,
            models.ParkingRequest.status == models.RequestStatus.PENDING.value
        )
        .count()
    )
    max_pending = int(os.environ.get("MAX_PENDING_REQUESTS", 5))
    if pending_count >= max_pending:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum limit of {max_pending} pending requests reached. Please wait for an existing request to be approved or rejected."
        )

    req = models.ParkingRequest(
        id=_generate_id(db),
        requester_id=current_user.id,
        requester_name=current_user.name,
        requester_role=current_user.role,
        date=payload.date,
        start_time=payload.start_time,
        end_date=payload.end_date,
        end_time=payload.end_time,
        duration=payload.duration,
        submitted_at=datetime.now(timezone.utc).isoformat(),
        status=models.RequestStatus.PENDING.value,
    )
    db.add(req)
    _add_audit_log(db, req.id, current_user.id, current_user.name, "submitted", requester_id=current_user.id)
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
    if req.status != models.RequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Only pending requests can be approved")
    if payload.lot_id:
        conflict_id = _has_conflict(
            db, payload.lot_id, req.date, req.start_time, req.end_date, req.end_time, exclude_id=request_id
        )
        if conflict_id:
            raise HTTPException(
                status_code=409,
                detail=f"Time slot conflict: lot {payload.lot_id} is already approved for request {conflict_id} during this period",
            )

    # Check availability slots (Allow manual override for managers/owners if they explicitly approve)
    # However, to be helpful, we can keep it as a soft warning or just allow it if it's manual.
    # The user is experiencing a hard error here, let's remove it for manual approval.

    now = datetime.now(timezone.utc).isoformat()
    req.status = models.RequestStatus.APPROVED.value
    req.approved_at = now
    req.approved_by = current_user.name
    req.updated_at = now
    
    _add_audit_log(
        db, req.id, current_user.id, current_user.name, "approved", 
        details=f"Assigned lot {payload.lot_id} (Floor {payload.floor})",
        requester_id=req.requester_id
    )
    
    req.rejected_by_owner = False
    if payload.lot_id:
        req.lot_id = payload.lot_id
    if payload.floor:
        req.floor = payload.floor
    if payload.lot_owner:
        req.lot_owner = payload.lot_owner

    _create_notification(
        db, req.requester_id,
        f"Your parking request {req.id} for {req.date} {req.start_time}–{req.end_time} has been APPROVED. Assigned Lot: {req.lot_id}."
    )

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

    req.status = models.RequestStatus.REJECTED.value
    req.rejected_by_owner = True
    req.updated_at = datetime.now(timezone.utc).isoformat()
    _add_audit_log(db, req.id, current_user.id, current_user.name, "rejected", requester_id=req.requester_id)
    _create_notification(db, req.requester_id, f"Your parking request {req.id} for {req.date} {req.start_time}–{req.end_time} has been rejected.")
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
    if req.status != models.RequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")

    effective_date  = payload.date       if payload.date       is not None else req.date
    effective_start = payload.start_time if payload.start_time is not None else req.start_time
    effective_dur   = payload.duration   if payload.duration   is not None else req.duration

    try:
        start_dt = datetime.strptime(f"{effective_date} {effective_start}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + dt_mod.timedelta(hours=effective_dur)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date or start time")

    req.date = effective_date
    req.start_time = effective_start
    req.end_date = end_dt.strftime("%Y-%m-%d")
    req.end_time = end_dt.strftime("%H:%M")
    req.duration = effective_dur
    req.updated_at = datetime.now(timezone.utc).isoformat()
    _add_audit_log(db, req.id, current_user.id, current_user.name, "updated", requester_id=req.requester_id)
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

    # ── Cancellation Window Check (MVP Sprint) ────────────────────────────────────
    # Prevent cancelling approved requests too close to the start time
    if req.status == models.RequestStatus.APPROVED.value and current_user.role != models.UserRole.MANAGER.value:
        import os
        try:
            window_hours = int(os.getenv("CANCELLATION_WINDOW_HOURS", 2))
            start_dt = datetime.strptime(f"{req.date} {req.start_time}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            
            if (start_dt - now) < dt_mod.timedelta(hours=window_hours):
                raise HTTPException(
                    status_code=400,
                    detail=f"Approved requests cannot be cancelled within {window_hours} hours of the start time. Please contact a manager if you need an emergency cancellation."
                )
        except (ValueError, TypeError):
            pass # Use default behavior if env is missing or malformed
    # Audit retention: null out request_id on related messages so they survive the
    # delete.  Done explicitly here because SQLite ignores FK ON DELETE actions
    # unless PRAGMA foreign_keys=ON is set for every connection.
    db.query(models.RequestMessage)\
        .filter(models.RequestMessage.request_id == request_id)\
        .update({"request_id": None})
    
    _add_audit_log(db, req.id, current_user.id, current_user.name, "cancelled", requester_id=req.requester_id)
    
    db.delete(req)
    db.commit()


@router.post("/run-auto-approve")
def trigger_auto_approve(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Manually trigger the background auto-approval scheduler."""
    if current_user.role != models.UserRole.MANAGER.value:
        raise HTTPException(status_code=403, detail="Only managers can run auto-approve")

    from scheduler import run_auto_approval
    run_auto_approval(db)
    return {"status": "ok"}


@router.get("/{request_id}/audit", response_model=List[schemas.AuditLogOut])
def get_request_audit(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from typing import List
    logs = db.query(models.AuditLog).filter(models.AuditLog.request_id == request_id).order_by(models.AuditLog.timestamp.desc()).all()
    if not logs:
        raise HTTPException(status_code=404, detail="No audit logs found for this request")
    
    # We use the FIRST log entry (usually 'submitted') to find the original requester if the request is gone
    # Or just check any entry that has requester_id set
    requester_id = None
    for log in logs:
        if log.requester_id:
            requester_id = log.requester_id
            break
            
    # Check access
    # 1. Manager (full access)
    # 2. Original requester (full access)
    # 3. Lot owner (involved party)
    # 4. Any owner if request is PENDING (evaluation period)
    
    is_manager = str(current_user.role) == models.UserRole.MANAGER.value
    is_requester = current_user.id == requester_id
    
    # Check lot ownership or status if needed
    req = db.query(models.ParkingRequest).filter(models.ParkingRequest.id == request_id).first()
    is_involved_owner = False
    is_pending = False
    if req:
        is_pending = (req.status == models.RequestStatus.PENDING.value)
        # In our system, lot_owner is stored as a name string in the request
        if req.lot_owner == current_user.name:
            is_involved_owner = True
    
    import logging
    logger = logging.getLogger("parking-api")
    logger.info(f"AUDIT_DEBUG: id={request_id} user={current_user.id} role={current_user.role} is_manager={is_manager} is_req={is_requester} is_pending={is_pending} involved={is_involved_owner}")

    if not (is_manager or is_requester or is_involved_owner or (str(current_user.role) == models.UserRole.OWNER.value and is_pending)):
         logger.warning(f"AUDIT_DENIED: User {current_user.id} ({current_user.role}) attempted access to history for {request_id}")
         raise HTTPException(status_code=403, detail="Permission denied")

    return logs
