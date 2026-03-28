from sqlalchemy import Column, String, Integer, Boolean
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")  # user | owner | manager


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


class Lot(Base):
    __tablename__ = "lots"

    id = Column(String, primary_key=True, index=True)
    floor = Column(String, nullable=False)                 # F1, F2, F3
    floor_label = Column(String, nullable=False)           # F1 - Ground Floor, etc.
    owner = Column(String, nullable=True)                  # owner name (denormalised for now)
    owner_id = Column(String, nullable=True)               # → users.id
    status = Column(String, nullable=False)                # available | blocked | unowned | unowned-blocked
    blocked_until = Column(String, nullable=True)
