"""
Tests for JWT validation in get_current_user: every way a token can be unacceptable must end in 401,
on read and write endpoints alike.

Signature/format failures are handled by decode_token; the two cases that pass decoding but must still
be refused ("valid token, user deleted" and "valid token, no subject") are the easy ones to miss.
"""

from datetime import timedelta

import jwt
import pytest

import models
from auth import ALGORITHM, SECRET_KEY, create_access_token
from .conftest import REQUEST_PAYLOAD


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _user_id(client, headers) -> str:
    return client.get("/auth/me", headers=headers).json()["id"]


# ── Valid signature, but the account is no longer acceptable ───────────────

def test_token_of_deleted_user_is_rejected(client, db_session, user_headers):
    user_id = _user_id(client, user_headers)
    assert client.get("/auth/me", headers=user_headers).status_code == 200

    db_session.delete(db_session.query(models.User).filter(models.User.id == user_id).one())
    db_session.commit()

    resp = client.get("/auth/me", headers=user_headers)
    assert resp.status_code == 401
    assert resp.json()["detail"] == "User not found"


def test_token_of_deleted_user_cannot_write(client, db_session, user_headers):
    user_id = _user_id(client, user_headers)
    db_session.delete(db_session.query(models.User).filter(models.User.id == user_id).one())
    db_session.commit()

    resp = client.post("/api/requests", json=REQUEST_PAYLOAD, headers=user_headers)
    assert resp.status_code == 401
    assert db_session.query(models.ParkingRequest).count() == 0


def test_token_for_unknown_user_id_is_rejected(client):
    token = create_access_token({"sub": "no-such-user-id"})
    resp = client.get("/auth/me", headers=_bearer(token))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "User not found"


def test_token_without_subject_is_rejected(client):
    token = create_access_token({})  # correctly signed and unexpired, but identifies nobody
    resp = client.get("/auth/me", headers=_bearer(token))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid token payload"


def test_token_with_empty_subject_is_rejected(client):
    resp = client.get("/auth/me", headers=_bearer(create_access_token({"sub": ""})))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid token payload"


# ── Bad tokens (handled by decode_token) ───────────────────────────────────

def test_expired_token_is_rejected(client, user_headers):
    user_id = _user_id(client, user_headers)
    token = create_access_token({"sub": user_id}, expires_delta=timedelta(minutes=-1))

    resp = client.get("/auth/me", headers=_bearer(token))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid or expired token"


def test_token_signed_with_another_key_is_rejected(client, user_headers):
    user_id = _user_id(client, user_headers)
    forged = jwt.encode({"sub": user_id}, "x" * 40, algorithm=ALGORITHM)

    resp = client.get("/auth/me", headers=_bearer(forged))
    assert resp.status_code == 401


def test_unsigned_token_is_rejected(client, user_headers):
    """alg=none tokens must never be accepted."""
    user_id = _user_id(client, user_headers)
    unsigned = jwt.encode({"sub": user_id}, key=None, algorithm="none")

    assert client.get("/auth/me", headers=_bearer(unsigned)).status_code == 401


def test_tampered_payload_is_rejected(client, user_headers, owner_headers):
    """Swapping the subject in a real token without re-signing must fail signature verification."""
    user_token = user_headers["Authorization"].split()[1]
    owner_id = _user_id(client, owner_headers)

    header, _, signature = user_token.split(".")
    forged_payload = jwt.utils.base64url_encode(
        f'{{"sub": "{owner_id}", "exp": 9999999999}}'.encode()
    ).decode()

    resp = client.get("/auth/me", headers=_bearer(f"{header}.{forged_payload}.{signature}"))
    assert resp.status_code == 401


@pytest.mark.parametrize("header_value", ["Bearer", "Bearer ", "Basic abc", "token-without-scheme"])
def test_malformed_authorization_header_is_rejected(client, header_value):
    resp = client.get("/auth/me", headers={"Authorization": header_value})
    assert resp.status_code == 401


def test_secret_key_is_loaded_for_tests():
    """Guards the fixture assumption these tests rely on (tokens above are signed with SECRET_KEY)."""
    assert SECRET_KEY
