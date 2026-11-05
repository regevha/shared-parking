from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr, field_validator

from schemas import PreferencesOut
import uuid

from database import get_db
import models
import auth as auth_utils

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    # NOTE: there is intentionally no `role` field. Public registration always
    # creates a plain "user"; owners/managers are promoted by a manager via
    # PATCH /api/users/{id}. Any `role` sent by a client is ignored.


def _prefs_out(user: models.User) -> PreferencesOut:
    """Serialise ALL of a user's preferences (language, windows, theme).

    Auth responses used to return only ``dark_mode``, so the saved language and
    availability/notification windows were never restored after login.
    """
    prefs = user.preferences[0] if user.preferences else None
    if prefs is None:
        return PreferencesOut()
    defaults = PreferencesOut()
    return PreferencesOut(
        dark_mode=True if prefs.dark_mode is None else prefs.dark_mode,
        availability_windows=prefs.availability_windows or defaults.availability_windows,
        notification_windows=prefs.notification_windows or defaults.notification_windows,
        language=prefs.language or defaults.language,
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    email: str
    role: str
    preferences: PreferencesOut


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


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    auth_utils._validate_password(payload.password)
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        id=str(uuid.uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=auth_utils.hash_password(payload.password),
        role=models.UserRole.USER.value,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(user)
    db.flush()  # get user.id before creating preferences

    db.add(models.UserPreferences(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not auth_utils.verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_utils.create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        preferences=_prefs_out(user),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        preferences=_prefs_out(current_user),
    )
