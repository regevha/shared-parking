from pydantic import BaseModel
from typing import Optional


# ── Parking Requests ────────────────────────────────────────────────────────

class ParkingRequestBase(BaseModel):
    requester_id: str
    requester_name: str
    date: str
    start_time: str
    end_time: str
    duration: int
    submitted_at: str
    status: str = "pending"
    rejected_by_owner: bool = False
    lot_id: Optional[str] = None
    floor: Optional[str] = None
    lot_owner: Optional[str] = None
    approved_at: Optional[str] = None


class ParkingRequestCreate(BaseModel):
    requester_id: str
    requester_name: str
    date: str
    start_time: str
    end_time: str
    duration: int


class ParkingRequestUpdate(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: Optional[int] = None


class ApprovePayload(BaseModel):
    lot_id: Optional[str] = None
    floor: Optional[str] = None
    lot_owner: Optional[str] = None


class ParkingRequestOut(ParkingRequestBase):
    id: str

    class Config:
        from_attributes = True


# ── Lots ─────────────────────────────────────────────────────────────────────

class LotOut(BaseModel):
    id: str
    floor: str
    floor_label: str
    owner: Optional[str]
    status: str
    blocked_until: Optional[str]

    class Config:
        from_attributes = True
