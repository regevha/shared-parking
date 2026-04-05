import pytest
from datetime import datetime, timedelta, timezone
from .conftest import REQUEST_PAYLOAD, _FUTURE_DATE

# ── End-to-End Walkthrough Scenario ──────────────────────────────────────────

def test_full_request_lifecycle_walkthrough(client, user_headers, owner_headers):
    """
    Scenario:
    1. Alice (User) submits a request for 2 hours.
    2. Bob (Owner) approves the request and assigns Lot F1-001.
    3. Alice receives a success notification.
    4. Alice tries to cancel a different request 1 hour before start time (400 error).
    5. Alice successfully cancels a future request (3 hours away) (204 success).
    """
    # 1. Submission
    # Start time 3 hours from now (outside 2-hour window)
    now_utc = datetime.now(timezone.utc)
    start_dt = now_utc + timedelta(hours=3)
    end_dt = start_dt + timedelta(hours=2)
    
    payload = {
        "date": start_dt.strftime("%Y-%m-%d"),
        "start_time": start_dt.strftime("%H:%M"),
        "end_date": end_dt.strftime("%Y-%m-%d"),
        "end_time": end_dt.strftime("%H:%M"),
        "duration": 2
    }
    
    r_sub = client.post("/api/requests", json=payload, headers=user_headers)
    assert r_sub.status_code == 201
    req_id = r_sub.json()["id"]
    
    # 2. Approval
    r_app = client.patch(
        f"/api/requests/{req_id}/approve",
        json={"lot_id": "F1-001", "floor": "F1", "lot_owner": "Bob Owner"},
        headers=owner_headers
    )
    assert r_app.status_code == 200
    
    # 3. Notification Receipt
    r_notif = client.get("/api/notifications", headers=user_headers)
    # Verify the specific message for this request code is present
    msg_found = any(req_id in n["message"] and "APPROVED" in n["message"] for n in r_notif.json())
    assert msg_found, f"Notification for {req_id} not found in {r_notif.json()}"

    # 4. Cancellation Policy Logic (Blocking)
    # Create another request that starts in only 1 hour
    tight_start_dt = now_utc + timedelta(minutes=60)
    tight_end_dt = tight_start_dt + timedelta(hours=2)
    
    r_tight = client.post("/api/requests", json={
        "date": tight_start_dt.strftime("%Y-%m-%d"),
        "start_time": tight_start_dt.strftime("%H:%M"),
        "end_date": tight_end_dt.strftime("%Y-%m-%d"),
        "end_time": tight_end_dt.strftime("%H:%M"),
        "duration": 2
    }, headers=user_headers)
    tight_id = r_tight.json()["id"]
    
    # Bob approves it
    client.patch(f"/api/requests/{tight_id}/approve", json={"lot_id": "F1-001"}, headers=owner_headers)
    
    # Now Alice tries to cancel — should be blocked by 2-hour policy
    r_cancel_fail = client.delete(f"/api/requests/{tight_id}", headers=user_headers)
    assert r_cancel_fail.status_code == 400
    assert "2 hours" in r_cancel_fail.json()["detail"].lower()
    
    # 5. Successful Cancellation (Outside window)
    # The first request (req_id) starts in 3 hours — should be allowed (3 > 2)
    r_cancel_ok = client.delete(f"/api/requests/{req_id}", headers=user_headers)
    assert r_cancel_ok.status_code == 204
