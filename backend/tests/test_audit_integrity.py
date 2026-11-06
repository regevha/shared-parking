from fastapi.testclient import TestClient
from .conftest import future_date

def test_audit_trail_privacy(client: TestClient, user_headers: dict, owner_headers: dict, manager_headers: dict):
    """Verify User B cannot see User A's audit log."""
    # 1. Create a request as User A
    payload = {
        "date": future_date(14),
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

def test_audit_trail_immutability(client: TestClient, user_headers: dict, manager_headers: dict):
    """Verify the audit trail cannot be modified via API (the endpoint only supports GET)."""
    resp = client.post("/api/requests", json={"date": future_date(14), "start_time": "09:00", "duration": 2}, headers=user_headers)
    assert resp.status_code == 201
    req_id = resp.json()["id"]
    audit_url = f"/api/requests/{req_id}/audit"

    # The route exists and is readable, so a refusal below is about the method, not a missing record
    assert client.get(audit_url, headers=manager_headers).status_code == 200

    for method in ("post", "put", "patch", "delete"):
        resp = getattr(client, method)(audit_url, headers=manager_headers)
        assert resp.status_code == 405, f"{method.upper()} on the audit endpoint returned {resp.status_code}"

def test_audit_trail_retention_on_deletion(client: TestClient, user_headers: dict, manager_headers: dict):
    """Verify audit logs survive request deletion."""
    # 1. Create request
    payload = {"date": future_date(14), "start_time": "10:00", "duration": 2}
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
