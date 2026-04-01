import re
from datetime import date as DateType
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional

_TIME_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


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
    updated_at: Optional[str] = None


class ParkingRequestCreate(BaseModel):
    requester_id: str
    requester_name: str
    date: str
    start_time: str
    end_time: str
    duration: int

    @field_validator('date')
    @classmethod
    def validate_date(cls, v: str) -> str:
        if not _DATE_RE.match(v):
            raise ValueError('date must be in YYYY-MM-DD format')
        try:
            d = DateType.fromisoformat(v)
        except ValueError:
            raise ValueError('date is not a valid calendar date')
        if d < DateType.today():
            raise ValueError('date cannot be in the past')
        return v

    @field_validator('start_time', 'end_time')
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError('time must be in HH:MM format')
        return v

    @model_validator(mode='after')
    def validate_time_range(self) -> 'ParkingRequestCreate':
        s, e = self.start_time, self.end_time
        if s >= e:
            raise ValueError('start_time must be before end_time')
        if s < '07:00':
            raise ValueError('start_time must be 07:00 or later')
        if e > '20:00':
            raise ValueError('end_time cannot be later than 20:00')
        expected = int(e.split(':')[0]) - int(s.split(':')[0])
        if self.duration != expected:
            raise ValueError(f'duration must be {expected} hour(s) to match start and end times')
        return self


class ParkingRequestUpdate(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: Optional[int] = None

    @field_validator('date')
    @classmethod
    def validate_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _DATE_RE.match(v):
            raise ValueError('date must be in YYYY-MM-DD format')
        try:
            d = DateType.fromisoformat(v)
        except ValueError:
            raise ValueError('date is not a valid calendar date')
        if d < DateType.today():
            raise ValueError('date cannot be in the past')
        return v

    @field_validator('start_time', 'end_time')
    @classmethod
    def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _TIME_RE.match(v):
            raise ValueError('time must be in HH:MM format')
        return v


class ApprovePayload(BaseModel):
    lot_id: Optional[str] = None
    floor: Optional[str] = None
    lot_owner: Optional[str] = None


class ParkingRequestOut(ParkingRequestBase):
    id: str

    class Config:
        from_attributes = True


# ── Request Messages ─────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    text: str

    @field_validator('text')
    @classmethod
    def validate_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Message text cannot be empty')
        if len(v) > 1000:
            raise ValueError('Message text cannot exceed 1000 characters')
        return v


class MessageOut(BaseModel):
    id: int
    request_id: Optional[str]
    sender_id: str
    sender_name: str
    sender_role: str
    text: str
    sent_at: str

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
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


# ── Users ─────────────────────────────────────────────────────────────────────

class PreferencesOut(BaseModel):
    dark_mode: bool = True
    # JSON-encoded notification windows, e.g. '{"Monday":[{"id":"1","startTime":"09:00","endTime":"12:00"}]}'
    notification_windows: Optional[str] = '{}'
    language: str = 'en'
    # ── add new preference fields here ─────────────────────────────────────────

    class Config:
        from_attributes = True


class PreferencesUpdate(BaseModel):
    dark_mode: Optional[bool] = None
    notification_windows: Optional[str] = None  # JSON-encoded
    language: Optional[str] = None              # 'en' | 'fr'
    # ── add new preference fields here ─────────────────────────────────────────


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: Optional[str] = None
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
