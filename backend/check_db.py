
from database import SessionLocal
import models

db = SessionLocal()
try:
    req_id = "REQ-P08"
    logs = db.query(models.AuditLog).filter(models.AuditLog.request_id == req_id).all()
    print(f"Audit Logs for {req_id}: {len(logs)}")
    for log in logs:
        print(f"  Action: {log.action}, User: {log.user_name}, RequesterID: {log.requester_id}, Time: {log.timestamp}")
finally:
    db.close()
