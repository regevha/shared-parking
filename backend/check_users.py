
from database import SessionLocal
import models

db = SessionLocal()
try:
    for uid in ["A1", "A2", "O1", "O3"]:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            print(f"User {uid}: Name={u.name}, Role={u.role}")
        else:
            print(f"User {uid}: Not Found")
finally:
    db.close()
