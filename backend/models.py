from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from enum import Enum
from datetime import datetime


class UserRole(str, Enum):
    USER = "user"
    OWNER = "owner"
    MANAGER = "manager"


class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LotStatus(str, Enum):
    AVAILABLE = "available"
    BLOCKED = "blocked"
    UNOWNED = "unowned"
    UNOWNED_BLOCKED = "unowned-blocked"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")  # user | owner | manager
    created_at = Column(String, nullable=True)             # ISO string — set on registration

    preferences = relationship(
        "UserPreferences",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # CASCADE: preferences have no meaning without their owner — delete with the user
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    dark_mode = Column(Boolean, nullable=False, default=True)
    # JSON-encoded dict: { "Monday": [{"id":"..","startTime":"..","endTime":".."}], … }
    availability_windows = Column(String, nullable=True, default='{}')
    notification_windows = Column(String, nullable=True, default='{}')
    language = Column(String, nullable=False, default='en')
    # ── add new preference columns here ────────────────────────────────────────

    user = relationship("User", back_populates="preferences")


class ParkingRequest(Base):
    __tablename__ = "parking_requests"

    id = Column(String, primary_key=True, index=True)
    requester_id = Column(String, nullable=False)          # → users.id
    requester_name = Column(String, nullable=False)
    requester_role = Column(String, nullable=True)          # user | owner | manager
    date = Column(String, nullable=False)                  # YYYY-MM-DD
    start_time = Column(String, nullable=False)            # HH:MM
    end_date = Column(String, nullable=True)               # YYYY-MM-DD
    end_time = Column(String, nullable=False)              # HH:MM
    duration = Column(Integer, nullable=False)             # hours
    submitted_at = Column(String, nullable=False)          # ISO string
    status = Column(String, nullable=False, default=RequestStatus.PENDING.value)  # pending | approved | rejected
    rejected_by_owner = Column(Boolean, default=False)
    lot_id = Column(String, nullable=True)
    floor = Column(String, nullable=True)
    lot_owner = Column(String, nullable=True)
    approved_at = Column(String, nullable=True)
    approved_by = Column(String, nullable=True)            # "auto" | owner name — set on approval
    updated_at = Column(String, nullable=True)             # ISO string — set on every status/field change


class RequestMessage(Base):
    __tablename__ = "request_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # SET NULL (not CASCADE): messages are preserved for 7-day audit retention after a
    # request is deleted.  The FK is nulled explicitly in delete_request() before the
    # parent row is removed (SQLite does not enforce FK actions without PRAGMA foreign_keys=ON).
    request_id = Column(String, ForeignKey("parking_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    sender_id = Column(String, nullable=False)      # → users.id
    sender_name = Column(String, nullable=False)    # denormalised for display
    sender_role = Column(String, nullable=False)    # user | owner | manager
    text = Column(String, nullable=False)
    sent_at = Column(String, nullable=False)        # ISO timestamp


class Lot(Base):
    __tablename__ = "lots"

    id = Column(String, primary_key=True, index=True)
    floor = Column(String, nullable=False)                 # F1, F2, F3
    floor_label = Column(String, nullable=False)           # F1 - Ground Floor, etc.
    owner = Column(String, nullable=True)                  # owner name (denormalised for now)
    owner_id = Column(String, nullable=True)               # → users.id
    status = Column(String, nullable=False)                # available | blocked | unowned | unowned-blocked
    blocked_until = Column(String, nullable=True)
    created_at = Column(String, nullable=True)             # ISO string — set on creation
    updated_at = Column(String, nullable=True)             # ISO string — set on every update


class LotAvailabilityWindow(Base):
    __tablename__ = "lot_availability_windows"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(String, ForeignKey("lots.id", ondelete="CASCADE"), nullable=False, index=True)
    # Recurring weekly slot: 0=Mon … 6=Sun; NULL means specific_date override
    day_of_week = Column(Integer, nullable=True)
    # One-time date override: "YYYY-MM-DD"; supersedes day_of_week when set
    specific_date = Column(String, nullable=True)
    start_time = Column(String, nullable=False)   # "HH:MM"
    end_time = Column(String, nullable=False)     # "HH:MM"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(String, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String, index=True, nullable=False)
    requester_id = Column(String, index=True, nullable=True) # ID of the user who submitted the request
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=False)
    action = Column(String, nullable=False)  # submitted | approved | rejected | cancelled | auto-assigned | updated
    details = Column(String, nullable=True)  # additional info like lot ID
    timestamp = Column(String, nullable=False) # ISO timestamp


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(String, nullable=False) # ISO timestamp
