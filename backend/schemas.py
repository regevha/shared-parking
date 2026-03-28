from pydantic import BaseModel, field_validator
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

class LotCreate(BaseModel):
    id: str
    floor: str
    floor_label: str
    owner: Optional[str] = None
    owner_id: Optional[str] = None
    status: str = "available"
    blocked_until: Optional[str] = None


class LotUpdate(BaseModel):
    """All fields optional — PATCH semantics."""
    status: Optional[str] = None          # available | blocked | unowned | unowned-blocked
    blocked_until: Optional[str] = None   # set to null to clear
    owner: Optional[str] = None           # display name
    owner_id: Optional[str] = None        # FK to users.id


class LotOut(BaseModel):
    id: str
    floor: str
    floor_label: str
    owner: Optional[str]
    owner_id: Optional[str] = None
    status: str
    blocked_until: Optional[str]

    class Config:
        from_attributes = True


# ── Users ─────────────────────────────────────────────────────────────────────

class PreferencesOut(BaseModel):
    dark_mode: bool = True
    # ── add new preference fields here ─────────────────────────────────────────

    class Config:
        from_attributes = True


class PreferencesUpdate(BaseModel):
    dark_mode: Optional[bool] = None
    # ── add new preference fields here ─────────────────────────────────────────


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    preferences: PreferencesOut

    @field_validator('preferences', mode='before')
    @classmethod
    def coerce_prefs_list(cls, v):
        if isinstance(v, list):
            return v[0] if v else PreferencesOut()
        return v

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Manager can update any field; a user can update name/email/password only."""
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None      # manager only
    password: Optional[str] = None  # plain text — will be hashed
