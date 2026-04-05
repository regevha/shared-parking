import pytest
from datetime import datetime, timezone
import models

def get_user_id(client, headers):
    resp = client.get("/auth/me", headers=headers)
    return resp.json()["id"]

# ── GET /api/notifications ──────────────────────────────────────────────────

def test_get_notifications_empty_initially(client, user_headers):
    resp = client.get("/api/notifications", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json() == []

def test_get_notifications_requires_auth(client):
    resp = client.get("/api/notifications")
    assert resp.status_code == 401

def test_get_notifications_returns_only_own(client, user_headers, owner_headers, db_session):
    # Get actual IDs
    alice_id = get_user_id(client, user_headers)
    bob_id = get_user_id(client, owner_headers)

    # Create notification for Bob manually
    notif = models.Notification(
        user_id=bob_id,
        message="Test Message for Bob",
        created_at=datetime.now(timezone.utc).isoformat()
    )
    db_session.add(notif)
    db_session.commit()
    
    # Alice should see nothing
    resp = client.get("/api/notifications", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json() == []
    
    # Bob should see it
    resp_owner = client.get("/api/notifications", headers=owner_headers)
    assert len(resp_owner.json()) == 1
    assert resp_owner.json()[0]["message"] == "Test Message for Bob"

# ── Status Trigger Tests ────────────────────────────────────────────────────

def test_approval_triggers_notification(client, user_headers, owner_headers, created_request_id):
    # 2. Bob approves Alice's request
    client.patch(
        f"/api/requests/{created_request_id}/approve",
        json={"lot_id": "F1-001", "floor": "F1", "lot_owner": "Bob Owner"},
        headers=owner_headers
    )
    
    # 3. Alice should now have 1 notification
    resp_after = client.get("/api/notifications", headers=user_headers)
    assert len(resp_after.json()) >= 1
    # Check if ANY notification contains the request ID and "APPROVED"
    assert any(created_request_id in n["message"] and "APPROVED" in n["message"] for n in resp_after.json())

def test_rejection_triggers_notification(client, user_headers, owner_headers):
    # 1. Alice creates a new request
    r = client.post("/api/requests", json={
        "date": "2026-06-01", "start_time": "12:00", "end_date": "2026-06-01", "end_time": "14:00", "duration": 2
    }, headers=user_headers)
    req_id = r.json()["id"]
    
    # 2. Bob rejects it
    client.patch(f"/api/requests/{req_id}/reject", headers=owner_headers)
    
    # 3. Alice should see a rejection notification
    resp = client.get("/api/notifications", headers=user_headers)
    assert any(req_id in n["message"] and "rejected" in n["message"].lower() for n in resp.json())

# ── Read Management ────────────────────────────────────────────────────────

def test_mark_as_read(client, user_headers, db_session):
    alice_id = get_user_id(client, user_headers)
    # 1. Create a notification
    notif = models.Notification(
        user_id=alice_id,
        message="Read Test",
        created_at=datetime.now(timezone.utc).isoformat()
    )
    db_session.add(notif)
    db_session.commit()
    db_session.refresh(notif)
    
    notif_id = notif.id
    
    # 2. Mark as read
    resp = client.patch(f"/api/notifications/{notif_id}/read", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True
    
    # 3. Verify in list
    resp_list = client.get("/api/notifications", headers=user_headers)
    assert any(n["id"] == notif_id and n["is_read"] for n in resp_list.json())

def test_mark_all_read(client, user_headers, db_session):
    alice_id = get_user_id(client, user_headers)
    # 1. Create 3 notifications
    for i in range(3):
         db_session.add(models.Notification(
            user_id=alice_id,
            message=f"Msg {i}",
            created_at=datetime.now(timezone.utc).isoformat()
        ))
    db_session.commit()
    
    # 2. Bulk read
    resp = client.post("/api/notifications/read-all", headers=user_headers)
    assert resp.status_code == 200
    
    # 3. Verify
    resp_list = client.get("/api/notifications", headers=user_headers)
    assert all(n["is_read"] for n in resp_list.json())

# ── Broadcast Tests ─────────────────────────────────────────────────────────

def test_broadcast_manager_only(client, user_headers):
    resp = client.post("/api/notifications/broadcast", json={"audience": "both", "message": "Hey"}, headers=user_headers)
    assert resp.status_code == 403

def test_broadcast_audience_targeting(client, manager_headers, user_headers, owner_headers):
    # 1. Send broadcast to owners only
    resp = client.post("/api/notifications/broadcast", json={"audience": "owners", "message": "Owners Only Alert"}, headers=manager_headers)
    assert resp.status_code == 200
    assert resp.json()["delivered_to"] >= 1

    # 2. Owner should see it
    resp_owner = client.get("/api/notifications", headers=owner_headers)
    assert any("Owners Only Alert" in n["message"] for n in resp_owner.json())

    # 3. Regular user should NOT see it
    resp_user = client.get("/api/notifications", headers=user_headers)
    assert not any("Owners Only Alert" in n["message"] for n in resp_user.json())
