import pytest
from fastapi.testclient import TestClient

def test_audit_trail_privacy(client: TestClient, user_headers: dict, owner_headers: dict, manager_headers: dict):
    """Verify User B cannot see User A's audit log."""
    # 1. Create a request as User A
    payload = {
        "date": "2026-05-01",
        "start_time": "09:00",
        "duration": 4
    }
    resp = client.post("/api/requests", json=payload, headers=user_headers)
    assert resp.status_code == 201
    req_id = resp.json()["id"]

    # 1a. (Wait, let's test that Owners CAN see pending)
    resp = client.get(f"/api/requests/{req_id}/audit", headers=owner_headers)
    assert resp.status_code == 200 # Allowed for evaluation

    # 1b. Manager rejects it or assigns to ANOTHER lot
    # Actually, if we reject it, it's no longer pending.
    client.patch(f"/api/requests/{req_id}/reject", headers=manager_headers)

    # 2. Try to view audit log as Owner (User B) who is NOT the requester or lottery
    resp = client.get(f"/api/requests/{req_id}/audit", headers=owner_headers)
    assert resp.status_code == 403

def test_audit_trail_immutability(client: TestClient, manager_headers: dict):
    """Verify the audit trail cannot be modified via API."""
    # Try POST, PUT, PATCH to the audit endpoint (which only supports GET)
    resp = client.post("/api/requests/REQ-001/audit", headers=manager_headers)
    assert resp.status_code in [404, 405]

    resp = client.patch("/api/requests/REQ-001/audit", headers=manager_headers)
    assert resp.status_code in [404, 405]

def test_audit_trail_retention_on_deletion(client: TestClient, user_headers: dict, manager_headers: dict):
    """Verify audit logs survive request deletion."""
    # 1. Create request
    payload = {"date": "2026-06-01", "start_time": "10:00", "duration": 2}
    resp = client.post("/api/requests", json=payload, headers=user_headers)
    req_id = resp.json()["id"]

    # 2. Verify audit exists
    resp = client.get(f"/api/requests/{req_id}/audit", headers=manager_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # 3. Delete request
    resp = client.delete(f"/api/requests/{req_id}", headers=user_headers)
    assert resp.status_code == 204 # Standard for successful DELETE

    # 4. Check audit log again. 
    resp = client.get(f"/api/requests/{req_id}/audit", headers=manager_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
