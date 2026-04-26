"""
Tests for /api/admin/import-users and /api/admin/import-lots endpoints.
Each test uses a fresh in-memory SQLite DB via the conftest fixtures.
"""

import io


# ── Helpers ────────────────────────────────────────────────────────────────

def csv_file(content: str, filename: str = "test.csv"):
    """Return a files dict suitable for TestClient multipart upload."""
    return {"file": (filename, io.BytesIO(content.encode()), "text/csv")}


# ── POST /api/admin/import-users ───────────────────────────────────────────

class TestImportUsers:
    def test_import_users_success(self, client, manager_headers):
        csv = "name,email,role,password\nAlice,alice@test.com,user,pass1\nBob,bob@test.com,owner,pass2\n"
        r = client.post("/api/admin/import-users", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 2
        assert body["errors"] == []

        # Verify users exist in DB via API
        r2 = client.get("/api/users", headers=manager_headers)
        emails = [u["email"] for u in r2.json()]
        assert "alice@test.com" in emails
        assert "bob@test.com" in emails

    def test_import_users_rejects_non_csv(self, client, manager_headers):
        r = client.post(
            "/api/admin/import-users",
            files={"file": ("users.txt", io.BytesIO(b"name,email\nAlice,a@test.com"), "text/plain")},
            headers=manager_headers,
        )
        assert r.status_code == 400

    def test_import_users_skips_duplicate_email(self, client, manager_headers):
        # Register a user first
        client.post("/auth/register", json={"name": "Existing", "email": "dup@test.com", "password": "pw"})

        csv = "name,email,role,password\nDuplicate,dup@test.com,user,pw\nNew,new@test.com,user,pw\n"
        r = client.post("/api/admin/import-users", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 1
        assert any("dup@test.com" in e for e in body["errors"])

    def test_import_users_skips_missing_fields(self, client, manager_headers):
        csv = "name,email,role,password\n,missing@test.com,user,pw\nNoEmail,,user,pw\nValid,valid@test.com,user,pw\n"
        r = client.post("/api/admin/import-users", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 1
        assert len(body["errors"]) == 2

    def test_import_users_default_role_is_user(self, client, manager_headers):
        csv = "name,email\nNoRole,norole@test.com\n"
        r = client.post("/api/admin/import-users", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        assert r.json()["imported"] == 1

        # Verify the user can log in with default password and has user role
        login = client.post("/auth/login", data={"username": "norole@test.com", "password": "password123"})
        assert login.status_code == 200
        assert login.json()["role"] == "user"

    def test_import_users_default_password(self, client, manager_headers):
        csv = "name,email,role\nNoPw,nopw@test.com,user\n"
        r = client.post("/api/admin/import-users", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        assert r.json()["imported"] == 1

        login = client.post("/auth/login", data={"username": "nopw@test.com", "password": "password123"})
        assert login.status_code == 200

    def test_import_users_requires_manager_role(self, client, user_headers, owner_headers):
        csv = "name,email\nAlice,alice@test.com\n"
        for headers in (user_headers, owner_headers):
            r = client.post("/api/admin/import-users", files=csv_file(csv), headers=headers)
            assert r.status_code == 403


# ── POST /api/admin/import-lots ────────────────────────────────────────────

class TestImportLots:
    def test_import_lots_success(self, client, manager_headers):
        csv = "id,floor,floor_label,owner_email\nLOT-X1,F1,Floor 1,\nLOT-X2,F2,Floor 2,\n"
        r = client.post("/api/admin/import-lots", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 2
        assert body["errors"] == []

        # Verify lots exist
        r2 = client.get("/api/lots", headers=manager_headers)
        lot_ids = [lot["id"] for lot in r2.json()]
        assert "LOT-X1" in lot_ids
        assert "LOT-X2" in lot_ids

    def test_import_lots_rejects_non_csv(self, client, manager_headers):
        r = client.post(
            "/api/admin/import-lots",
            files={"file": ("lots.json", io.BytesIO(b"{}"), "application/json")},
            headers=manager_headers,
        )
        assert r.status_code == 400

    def test_import_lots_skips_duplicate_id(self, client, manager_headers):
        # Create a lot first
        client.post("/api/lots", json={"id": "LOT-DUP", "floor": "F1", "floor_label": "F1"}, headers=manager_headers)

        csv = "id,floor,floor_label,owner_email\nLOT-DUP,F1,Floor 1,\nLOT-NEW,F1,Floor 1,\n"
        r = client.post("/api/admin/import-lots", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 1
        assert any("LOT-DUP" in e for e in body["errors"])

    def test_import_lots_skips_missing_id_or_floor(self, client, manager_headers):
        csv = "id,floor,floor_label\n,F1,Floor 1\nLOT-Y1,,Floor 2\nLOT-Y2,F3,Floor 3\n"
        r = client.post("/api/admin/import-lots", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 1
        assert len(body["errors"]) == 2

    def test_import_lots_resolves_owner_email(self, client, manager_headers):
        # Create an owner user
        client.post("/auth/register", json={"name": "Owner Jane", "email": "jane@test.com", "password": "pw"})

        csv = "id,floor,floor_label,owner_email\nLOT-OWN,F1,Floor 1,jane@test.com\n"
        r = client.post("/api/admin/import-lots", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        assert r.json()["imported"] == 1

        # Verify owner name on lot
        lot = client.get("/api/lots/LOT-OWN", headers=manager_headers).json()
        assert lot["owner"] == "Owner Jane"
        assert lot["owner_id"] is not None

    def test_import_lots_unknown_owner_email_creates_unowned(self, client, manager_headers):
        csv = "id,floor,floor_label,owner_email\nLOT-UNO,F1,Floor 1,nobody@nowhere.com\n"
        r = client.post("/api/admin/import-lots", files=csv_file(csv), headers=manager_headers)
        assert r.status_code == 200
        assert r.json()["imported"] == 1

        lot = client.get("/api/lots/LOT-UNO", headers=manager_headers).json()
        assert lot["owner"] is None
        assert lot["owner_id"] is None

    def test_import_lots_requires_manager_role(self, client, user_headers, owner_headers):
        csv = "id,floor\nLOT-Z1,F1\n"
        for headers in (user_headers, owner_headers):
            r = client.post("/api/admin/import-lots", files=csv_file(csv), headers=headers)
            assert r.status_code == 403
