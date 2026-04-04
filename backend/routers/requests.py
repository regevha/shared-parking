from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import datetime as dt_mod
import json
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user, require_owner

router = APIRouter(prefix="/api/requests", tags=["requests"])


def _generate_id(db: Session) -> str:
    count = db.query(models.ParkingRequest).count()
    return f"REQ-{count + 1:03d}"


def _has_conflict(
    db: Session,
    lot_id: str | None,
    start_date: str,
    start_time: str,
    end_date: str,
    end_time: str,
    exclude_id: str | None = None,
) -> bool:
    """Return True if an approved request overlaps with the start_dt–end_dt range."""
    if not lot_id:
        return False
    
    from datetime import datetime
    new_start = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
    new_end = datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M")

    # We check all approved requests for that lot. Since most are local to a few days, 
    # we can filter by start_date - 2 days to start_date + 2 days for performance.
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
            return True
            
    return False


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

    from datetime import datetime, timedelta
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
            # Either it ends at the end of the request OR at 23:59 of this day
            segment_start_str = check_dt.strftime("%H:%M")
            
            # If end_dt is on the same day as check_dt
            if end_dt.date() == check_dt.date():
                segment_end_str = end_dt.strftime("%H:%M")
            else:
                segment_end_str = "23:59" # End of day

            # Check if THIS segment is covered by any window on THIS day
            segment_covered = False
            for slot in day_slots:
                if segment_start_str >= slot['startTime'] and segment_end_str <= slot['endTime']:
                    segment_covered = True
                    break
            
            if not segment_covered:
                return True # This specific day segment isn't shared
            
            # Move to the start of the next day
            check_dt = datetime.strptime(f"{check_dt.strftime('%Y-%m-%d')} 00:00", "%Y-%m-%d %H:%M") + timedelta(days=1)
            
        return False
    except Exception:
        return True


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
    """Create a new parking request. Limit: 5 pending requests per user."""
    pending_count = (
        db.query(models.ParkingRequest)
        .filter(
            models.ParkingRequest.requester_id == current_user.id,
            models.ParkingRequest.status == "pending"
        )
        .count()
    )
    if pending_count >= 5:
        raise HTTPException(
            status_code=400,
            detail="Maximum limit of 5 pending requests reached. Please wait for an existing request to be approved or rejected."
        )

    req = models.ParkingRequest(
        id=_generate_id(db),
        requester_id=current_user.id,
        requester_name=current_user.name,
        date=payload.date,
        start_time=payload.start_time,
        end_date=payload.end_date,
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
    if payload.lot_id and _has_conflict(
        db, payload.lot_id, req.date, req.start_time, req.end_date, req.end_time, exclude_id=request_id
    ):
        raise HTTPException(
            status_code=409,
            detail=f"Time slot conflict: lot {payload.lot_id} is already approved for this period",
        )

    # NEW: Check availability slots
    if payload.lot_id and _is_outside_availability(
        db, payload.lot_id, req.date, req.start_time, req.end_date, req.end_time
    ):
        raise HTTPException(
            status_code=400,
            detail="Outside availability windows: This lot is blocked for sharing at this time."
        )

    now = datetime.now(timezone.utc).isoformat()
    req.status = "approved"
    req.approved_at = now
    req.approved_by = current_user.name
    req.updated_at = now
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
    req.updated_at = datetime.now(timezone.utc).isoformat()
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

    effective_date  = payload.date       if payload.date       is not None else req.date
    effective_start = payload.start_time if payload.start_time is not None else req.start_time
    effective_dur   = payload.duration   if payload.duration   is not None else req.duration

    from datetime import datetime, timedelta
    try:
        start_dt = datetime.strptime(f"{effective_date} {effective_start}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(hours=effective_dur)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date or start time")

    req.date = effective_date
    req.start_time = effective_start
    req.end_date = end_dt.strftime("%Y-%m-%d")
    req.end_time = end_dt.strftime("%H:%M")
    req.duration = effective_dur
    req.updated_at = datetime.now(timezone.utc).isoformat()

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
    # Audit retention: null out request_id on related messages so they survive the
    # delete.  Done explicitly here because SQLite ignores FK ON DELETE actions
    # unless PRAGMA foreign_keys=ON is set for every connection.
    db.query(models.RequestMessage)\
        .filter(models.RequestMessage.request_id == request_id)\
        .update({"request_id": None})
    db.delete(req)
    db.commit()


@router.post("/run-auto-approve")
def trigger_auto_approve(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Manually trigger the background auto-approval scheduler."""
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can run auto-approve")

    from scheduler import run_auto_approval
    run_auto_approval(db)
    return {"status": "ok"}
