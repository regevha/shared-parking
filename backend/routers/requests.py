from fastapi import APIRouter, Depends, HTTPException
import os
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import datetime as dt_mod
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user, require_owner

router = APIRouter(prefix="/api/requests", tags=["requests"])


def _generate_id(db: Session) -> str:
    """Generate the next sequential REQ-NNN id.

    The next number is the numeric maximum of the existing REQ-<digits> ids.
    (Sorting the id strings is wrong: "REQ-999" sorts above "REQ-1000", which
    made the generator hand out REQ-1000 repeatedly once it was first used.)
    """
    rows = db.query(models.ParkingRequest.id).filter(models.ParkingRequest.id.like("REQ-%")).all()
    numbers = [int(r[0][4:]) for r in rows if r[0][4:].isdigit()]
    if not numbers:
        return "REQ-001"
    return f"REQ-{max(numbers) + 1:03d}"


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


def _slot_is_parseable(start_date: str, start_time: str, end_date: str, end_time: str) -> bool:
    """True if the stored start and end can be read as real dates and times.

    The API validates input, so a False here means a malformed row already in the database
    (old import, manual edit). Callers use it to refuse or skip such a row instead of crashing.
    """
    try:
        datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
        datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return False
    return True


def _has_conflict(
    db: Session,
    lot_id: str,
    start_date: str,
    start_time: str,
    end_date: str,
    end_time: str,
) -> str | None:
    """Return the ID of the conflicting approved request if one overlaps, else None.

    Only approved requests are compared, and callers pass a request that is still pending,
    so the request being checked can never match itself.
    """
    new_start = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
    new_end = datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M")

    # We check all approved requests for that lot.
    existing = db.query(models.ParkingRequest).filter(
        models.ParkingRequest.lot_id == lot_id,
        models.ParkingRequest.status == "approved"
    ).all()

    for r in existing:
        r_start = datetime.strptime(f"{r.date} {r.start_time}", "%Y-%m-%d %H:%M")
        r_end = datetime.strptime(f"{r.end_date} {r.end_time}", "%Y-%m-%d %H:%M")
        
        # Standard overlap check: (s1 < e2) and (e1 > s2)
        if new_start < r_end and new_end > r_start:
            return r.id
            
    return None


def _is_outside_availability(
    db: Session,
    lot_id: str,
    start_date: str,
    start_time: str,
    end_date: str,
    end_time: str,
) -> bool:
    """
    Return True if the slot is NOT fully contained within the lot's availability windows.
    Lots are blocked by default: if no active windows exist for a day, that day is blocked.
    Checked day-by-day for multi-day requests.
    Specific-date windows take precedence over recurring day_of_week windows.
    """
    lot = db.query(models.Lot).filter(models.Lot.id == lot_id).first()
    # Unowned lots have no availability windows — allow any time
    if not lot or not lot.owner_id:
        return False

    active_windows = (
        db.query(models.LotAvailabilityWindow)
        .filter(
            models.LotAvailabilityWindow.lot_id == lot_id,
            models.LotAvailabilityWindow.is_active == True,
        )
        .all()
    )
    # No windows defined at all → lot is completely blocked
    if not active_windows:
        return True

    try:
        start_dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
        end_dt   = datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M")

        check_dt = start_dt
        while check_dt < end_dt:
            date_str = check_dt.strftime("%Y-%m-%d")
            dow      = check_dt.weekday()  # 0=Mon … 6=Sun

            segment_start = check_dt.strftime("%H:%M")
            if end_dt.date() == check_dt.date():
                segment_end = end_dt.strftime("%H:%M")
            else:
                segment_end = "23:59"

            # Specific-date windows override recurring ones for this day
            specific = [w for w in active_windows if w.specific_date == date_str]
            recurring = [w for w in active_windows if w.specific_date is None and w.day_of_week == dow]
            day_windows = specific if specific else recurring

            covered = any(
                segment_start >= w.start_time and segment_end <= w.end_time
                for w in day_windows
            )
            if not covered:
                return True

            next_day = check_dt.date() + timedelta(days=1)
            check_dt = datetime.combine(next_day, datetime.min.time())

        return False
    except (ValueError, AttributeError):
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
    """Create a new parking request. Limit: 5 pending future requests per user."""
    today = dt_mod.date.today().isoformat()
    pending_count = (
        db.query(models.ParkingRequest)
        .filter(
            models.ParkingRequest.requester_id == current_user.id,
            models.ParkingRequest.status == models.RequestStatus.PENDING.value,
            models.ParkingRequest.date >= today,
        )
        .count()
    )
    max_pending = int(os.environ.get("MAX_PENDING_REQUESTS", 10))
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
        lot = db.query(models.Lot).filter(models.Lot.id == payload.lot_id).first()
        if not lot:
            raise HTTPException(status_code=404, detail="Lot not found")
        if lot.owner != current_user.name and current_user.role != "manager":
            raise HTTPException(status_code=403, detail="You can only assign lots you own")
        if not _slot_is_parseable(req.date, req.start_time, req.end_date, req.end_time):
            raise HTTPException(status_code=400, detail="Request has an invalid date or time and cannot be approved")
        conflict_id = _has_conflict(
            db, payload.lot_id, req.date, req.start_time, req.end_date, req.end_time
        )
        if conflict_id:
            raise HTTPException(
                status_code=409,
                detail=f"Time slot conflict: lot {payload.lot_id} is already approved for request {conflict_id} during this period",
            )
        # Managers may override availability; owners respect their own windows
        is_manager = current_user.role == models.UserRole.MANAGER.value
        if not is_manager and _is_outside_availability(
            db, payload.lot_id, req.date, req.start_time, req.end_date, req.end_time
        ):
            raise HTTPException(
                status_code=403,
                detail="Lot is not available at the requested time. Define an availability window first, or ask a manager to override.",
            )

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
