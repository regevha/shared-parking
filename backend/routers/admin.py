from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import csv
import io
import uuid
import models
from database import get_db
from auth import require_manager, hash_password
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.post("/import-users")
def import_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager)
):
    """Bulk import users from CSV. Format: name,email,role,password"""
    if not file.filename.endswith('.csv'):
         raise HTTPException(status_code=400, detail="Only CSV files supported for now")
    
    content = file.file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    
    count = 0
    errors = []
    
    for row in reader:
        try:
            name = row.get('name')
            email = row.get('email')
            role = row.get('role', 'user')
            password = row.get('password', 'password123')
            
            if not name or not email:
                errors.append(f"Missing name or email in row {count + 1}")
                continue
                
            if db.query(models.User).filter(models.User.email == email).first():
                errors.append(f"Email {email} already exists")
                continue
            
            new_user = models.User(
                id=str(uuid.uuid4()),
                name=name,
                email=email,
                role=role,
                password_hash=hash_password(password),
                created_at=datetime.now(timezone.utc).isoformat()
            )
            db.add(new_user)
            db.flush()
            db.add(models.UserPreferences(user_id=new_user.id))
            count += 1
        except Exception as e:
            errors.append(str(e))
            
    db.commit()
    return {"status": "ok", "imported": count, "errors": errors}

@router.post("/import-lots")
def import_lots(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager)
):
    """Bulk import lots from CSV. Format: id,floor,floor_label,owner_email"""
    if not file.filename.endswith('.csv'):
         raise HTTPException(status_code=400, detail="Only CSV files supported for now")
         
    content = file.file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    
    count = 0
    errors = []
    
    for row in reader:
        try:
            lot_id = row.get('id')
            floor = row.get('floor')
            label = row.get('floor_label')
            owner_email = row.get('owner_email')
            
            if not lot_id or not floor:
                errors.append(f"Missing id or floor in row {count + 1}")
                continue
                
            if db.query(models.Lot).filter(models.Lot.id == lot_id).first():
                errors.append(f"Lot {lot_id} already exists")
                continue
                
            owner_id = None
            owner_name = None
            if owner_email:
                owner = db.query(models.User).filter(models.User.email == owner_email).first()
                if owner:
                    owner_id = owner.id
                    owner_name = owner.name
            
            new_lot = models.Lot(
                id=lot_id,
                floor=floor,
                floor_label=label or floor,
                owner=owner_name,
                owner_id=owner_id,
                status="available" if not owner_id else "available", # Simplified
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat()
            )
            # Savepoint: a row the database rejects (e.g. the same id twice in one file) is rolled back and
            # reported on its own, instead of failing the final commit and losing the whole import.
            with db.begin_nested():
                db.add(new_lot)
                db.flush()
            count += 1
        except IntegrityError:
            errors.append(f"Lot {lot_id} already exists")
        except Exception as e:
            errors.append(str(e))
            
    db.commit()
    return {"status": "ok", "imported": count, "errors": errors}
