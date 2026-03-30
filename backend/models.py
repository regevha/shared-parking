from sqlalchemy import Column, String, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")  # user | owner | manager

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
    notification_windows = Column(String, nullable=True, default='{}')
    # ── add new preference columns here ────────────────────────────────────────

    user = relationship("User", back_populates="preferences")


class ParkingRequest(Base):
    __tablename__ = "parking_requests"

    id = Column(String, primary_key=True, index=True)
    requester_id = Column(String, nullable=False)          # → users.id
    requester_name = Column(String, nullable=False)
    date = Column(String, nullable=False)                  # YYYY-MM-DD
    start_time = Column(String, nullable=False)            # HH:MM
    end_time = Column(String, nullable=False)              # HH:MM
    duration = Column(Integer, nullable=False)             # hours
    submitted_at = Column(String, nullable=False)          # ISO string
    status = Column(String, nullable=False, default="pending")  # pending | approved | rejected
    rejected_by_owner = Column(Boolean, default=False)
    lot_id = Column(String, nullable=True)
    floor = Column(String, nullable=True)
    lot_owner = Column(String, nullable=True)
    approved_at = Column(String, nullable=True)


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
