from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
import schemas
from auth import get_current_user, require_manager, hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[schemas.UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    """List all users. Manager only."""
    return db.query(models.User).all()


@router.get("/me", response_model=schemas.UserOut)
def get_me(
    current_user: models.User = Depends(get_current_user),
):
    """Return the authenticated user's profile."""
    return current_user


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get a user by ID. Manager sees any user; others can only see themselves."""
    if current_user.role != "manager" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorised to view this user")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Update a user.
    - Manager: can change name, email, role, password of any user.
    - Self: can change own name, email, password only (not role).
    """
    is_manager = current_user.role == "manager"
    is_self = current_user.id == user_id

    if not is_manager and not is_self:
        raise HTTPException(status_code=403, detail="Not authorised to update this user")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is not None:
        user.name = payload.name

    if payload.email is not None:
        # Ensure the new email isn't already taken by someone else
        conflict = (
            db.query(models.User)
            .filter(models.User.email == payload.email, models.User.id != user_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email

    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    if payload.role is not None:
        if not is_manager:
            raise HTTPException(status_code=403, detail="Only managers can change roles")
        user.role = payload.role

    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}/preferences", response_model=schemas.PreferencesOut)
def get_preferences(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return a user's preferences. Manager sees any user; others can only see themselves."""
    if current_user.role != "manager" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorised to view these preferences")
    prefs = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return prefs


@router.patch("/{user_id}/preferences", response_model=schemas.PreferencesOut)
def update_preferences(
    user_id: str,
    payload: schemas.PreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update a user's preferences. Manager can update any user; others can only update themselves."""
    if current_user.role != "manager" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorised to update these preferences")
    prefs = db.query(models.UserPreferences).filter(models.UserPreferences.user_id == user_id).first()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    if payload.dark_mode is not None:
        prefs.dark_mode = payload.dark_mode
    if payload.notification_windows is not None:
        prefs.notification_windows = payload.notification_windows
    if payload.language is not None:
        prefs.language = payload.language
    db.commit()
    db.refresh(prefs)
    return prefs


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    """Delete a user. Manager only."""
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
