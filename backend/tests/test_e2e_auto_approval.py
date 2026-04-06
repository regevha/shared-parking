import pytest
import models
from .conftest import REQUEST_PAYLOAD, LOT_PAYLOAD

def test_e2e_auto_approval_flow(client, user_headers, manager_headers, db_session):
    """
    E2E Walkthrough: 
    1. Manager creates an available lot.
    2. User submits a request (Pending).
    3. Manager triggers the auto-approval API endpoint.
    4. Verify request is Approved and notification is sent to the User.
    """
    # 1. Manager creates a lot
    lot_resp = client.post("/api/lots", json=LOT_PAYLOAD, headers=manager_headers)
    assert lot_resp.status_code == 201
    lot_id = LOT_PAYLOAD["id"]

    # 2. User submits a request
    req_resp = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert req_resp.status_code == 201
    req_id = req_resp.json()["id"]

    # Verify it is pending
    pending_resp = client.get("/api/requests/pending", headers=user_headers)
    assert any(r["id"] == req_id for r in pending_resp.json())

    # 3. Manager triggers auto-approval via API
    trigger_resp = client.post("/api/config/run-auto-approval", headers=manager_headers)
    assert trigger_resp.status_code == 200
    assert trigger_resp.json()["approved"] >= 1

    # 4. Verify request is Approved
    approved_resp = client.get("/api/requests/approved", headers=user_headers)
    assert any(r["id"] == req_id for r in approved_resp.json())
    
    req_data = next(r for r in approved_resp.json() if r["id"] == req_id)
    assert req_data["status"] == "approved"
    assert req_data["lot_id"] == lot_id
    assert req_data["approved_by"] == "auto"

    # 5. Verify User received a notification
    notif_resp = client.get("/api/notifications", headers=user_headers)
    assert notif_resp.status_code == 200
    notifications = notif_resp.json()
    assert any(req_id in n["message"] and "APPROVED" in n["message"] for n in notifications)

def test_e2e_auto_approval_conflict(client, user_headers, manager_headers, db_session):
    """
    E2E Conflict Walkthrough:
    1. Manager creates 1 lot.
    2. User submits two overlapping requests.
    3. Trigger auto-approval.
    4. Verify first request is Approved and second stays Pending.
    """
    # 1. Manager creates a lot
    client.post("/api/lots", json=LOT_PAYLOAD, headers=manager_headers)

    # 2. Submits first (09:00-11:00)
    payload_a = {**REQUEST_PAYLOAD, "start_time": "09:00", "duration": 2}
    resp_a = client.post("/api/requests", json=payload_a, headers=user_headers)
    assert resp_a.status_code == 201
    id_a = resp_a.json()["id"]

    # 3. Submits overlapping second (10:00-12:00)
    payload_b = {**REQUEST_PAYLOAD, "start_time": "10:00", "duration": 2}
    resp_b = client.post("/api/requests", json=payload_b, headers=user_headers)
    assert resp_b.status_code == 201
    id_b = resp_b.json()["id"]

    # 4. Trigger auto-approval
    trigger_resp = client.post("/api/config/run-auto-approval", headers=manager_headers)
    assert trigger_resp.status_code == 200
    assert trigger_resp.json()["approved"] == 1 

    # 5. Verify A is approved
    approved_resp = client.get("/api/requests/approved", headers=user_headers)
    assert any(r["id"] == id_a for r in approved_resp.json())

    # 6. Verify B is still pending
    pending_resp = client.get("/api/requests/pending", headers=user_headers)
    assert any(r["id"] == id_b for r in pending_resp.json())

def test_auto_approval_manager_only(client, user_headers):
    """Verify that regular users cannot trigger auto-approval."""
    resp = client.post("/api/config/run-auto-approval", headers=user_headers)
    assert resp.status_code == 403
