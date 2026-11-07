import re
import os
from datetime import date as DateType
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from models import RequestStatus

_TIME_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


# ── Parking Requests ────────────────────────────────────────────────────────

class ParkingRequestBase(BaseModel):
    requester_id: str
    requester_name: str
    requester_role: Optional[str] = None
    date: str
    start_time: str
    end_date: Optional[str] = None
    end_time: str
    duration: int
    submitted_at: str
    status: str = RequestStatus.PENDING.value
    rejected_by_owner: bool = False
    lot_id: Optional[str] = None
    floor: Optional[str] = None
    lot_owner: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None
    updated_at: Optional[str] = None


class ParkingRequestCreate(BaseModel):
    requester_id: Optional[str] = None
    requester_name: Optional[str] = None
    requester_role: Optional[str] = None
    date: str
    start_time: str
    end_date: Optional[str] = None
    end_time: Optional[str] = None
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
    def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _TIME_RE.match(v):
            raise ValueError('time must be in HH:MM format')
        return v

    @model_validator(mode='after')
    def validate_time_range(self) -> 'ParkingRequestCreate':
        from datetime import datetime, timedelta
        
        min_dur = int(os.environ.get("MIN_REQUEST_DURATION_HOURS", 1))
        max_dur = int(os.environ.get("MAX_REQUEST_DURATION_HOURS", 36))
        
        if self.duration < min_dur or self.duration > max_dur:
            raise ValueError(f'duration must be between {min_dur} and {max_dur} hours')

        try:
            start_dt = datetime.strptime(f"{self.date} {self.start_time}", "%Y-%m-%d %H:%M")
            calc_end_dt = start_dt + timedelta(hours=self.duration)
            
            # If not provided, set them now
            if not self.end_date:
                self.end_date = calc_end_dt.strftime("%Y-%m-%d")
            if not self.end_time:
                self.end_time = calc_end_dt.strftime("%H:%M")
                
            # Verify they are consistent if they WERE provided
            provided_end_dt = datetime.strptime(f"{self.end_date} {self.end_time}", "%Y-%m-%d %H:%M")
            if abs((provided_end_dt - calc_end_dt).total_seconds()) > 60:
                raise ValueError(f'end_date/end_time do not match duration {self.duration}h. Expected {calc_end_dt}')

        except Exception as ex:
            if isinstance(ex, ValueError):
                raise ex
            raise ValueError(f'Invalid date/time combination: {ex}')

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

_ALLOWED_LANGUAGES = {'en', 'fr', 'he'}


class PreferencesOut(BaseModel):
    dark_mode: bool = True
    # JSON-encoded dict: { "Monday": [{"id":"..","startTime":"..","endTime":".."}], … }
    availability_windows: Optional[str] = '{}'
    notification_windows: Optional[str] = '{}'
    language: str = 'en'
    # ── add new preference fields here ─────────────────────────────────────────

    class Config:
        from_attributes = True


class PreferencesUpdate(BaseModel):
    dark_mode: Optional[bool] = None
    availability_windows: Optional[str] = None  # JSON-encoded
    notification_windows: Optional[str] = None  # JSON-encoded
    language: Optional[str] = None

    @field_validator('language')
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _ALLOWED_LANGUAGES:
            raise ValueError(f'language must be one of {sorted(_ALLOWED_LANGUAGES)}')
        return v
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


class AuditLogOut(BaseModel):
    id: int
    request_id: str
    requester_id: Optional[str] = None
    user_id: str
    user_name: str
    action: str
    details: Optional[str] = None
    timestamp: str

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: int
    user_id: str
    message: str
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True

class BroadcastPayload(BaseModel):
    audience: str # both | users | owners
    message: str


# ── Lot Availability Windows ──────────────────────────────────────────────────

_DOW_RE = re.compile(r'^[0-6]$')


class LotAvailabilityWindowCreate(BaseModel):
    day_of_week: Optional[int] = None     # 0=Mon … 6=Sun; mutually exclusive with specific_date
    specific_date: Optional[str] = None   # "YYYY-MM-DD"
    start_time: str
    end_time: str

    @field_validator('start_time', 'end_time')
    @classmethod
    def validate_time(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError('time must be in HH:MM format')
        return v

    @field_validator('day_of_week')
    @classmethod
    def validate_dow(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (0 <= v <= 6):
            raise ValueError('day_of_week must be 0 (Mon) … 6 (Sun)')
        return v

    @field_validator('specific_date')
    @classmethod
    def validate_specific_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _DATE_RE.match(v):
            raise ValueError('specific_date must be YYYY-MM-DD')
        return v

    @model_validator(mode='after')
    def validate_exclusive(self) -> 'LotAvailabilityWindowCreate':
        if self.day_of_week is None and self.specific_date is None:
            raise ValueError('Provide either day_of_week or specific_date')
        if self.day_of_week is not None and self.specific_date is not None:
            raise ValueError('Provide only one of day_of_week or specific_date, not both')
        if self.start_time >= self.end_time:
            raise ValueError('end_time must be after start_time')
        return self


class LotAvailabilityWindowUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('start_time', 'end_time')
    @classmethod
    def validate_time(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _TIME_RE.match(v):
            raise ValueError('time must be in HH:MM format')
        return v


class LotAvailabilityWindowOut(BaseModel):
    id: int
    lot_id: str
    day_of_week: Optional[int] = None
    specific_date: Optional[str] = None
    start_time: str
    end_time: str
    is_active: bool
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class AvailabilityCheckOut(BaseModel):
    """Informational result for the request form: how many lots could take the requested slot."""
    available_lots: int
    total_lots: int
