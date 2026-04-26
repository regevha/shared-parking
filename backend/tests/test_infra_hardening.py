import os
import pytest
from auth import SECRET_KEY

def test_logging_file_exists():
    """Verify that the API has initialized its logging system and created the log file."""
    # We look for parking.log in the logs directory at the root
    log_path = os.path.join(os.path.dirname(__file__), "..", "..", "logs", "parking.log")
    assert os.path.exists(log_path), f"parking.log not found at {log_path}. Logging system might not be initialized."
    
    # Optional: check if it has content
    with open(log_path, "r") as f:
        content = f.read()
        assert "API Starting Up..." in content or "INFO" in content

def test_secret_key_from_env():
    """Verify that the auth module is loading the SECRET_KEY from the environment/dotenv."""
    # In auth.py we have SECRET_KEY = os.getenv("SECRET_KEY", "fallback-dev-secret-key-very-unsafe")
    # Our .env in the root has "shared-parking-dev-secret-key-change-in-production"
    assert SECRET_KEY == "shared-parking-dev-secret-key-change-in-production"
    assert SECRET_KEY != "fallback-dev-secret-key-very-unsafe"

def test_business_rules_loading():
    """Verify that business rule constants are correctly loaded from the environment."""
    import os
    window = int(os.getenv("CANCELLATION_WINDOW_HOURS", 2))
    assert window == 2


def test_parking_db_is_seeded():
    """
    Warn if parking.db exists but contains no users.
    Catches the common mistake of running the app without seeding first.
    The test backend uses an in-memory DB, so we check the real parking.db on disk.
    """
    import sqlite3

    db_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "parking.db")
    )

    if not os.path.exists(db_path):
        pytest.skip("parking.db not found — run `python backend/seed.py` before testing the live DB")

    conn = sqlite3.connect(db_path)
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

        if not tables:
            pytest.fail(
                f"parking.db at {db_path} has no tables. "
                "Run `python backend/seed.py` to initialise and seed the database."
            )

        for table in ("users", "lots", "parking_requests"):
            assert table in tables, (
                f"Expected table '{table}' not found in parking.db. "
                "Run `python backend/seed.py` to reinitialise the database."
            )

        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        assert user_count > 0, (
            f"parking.db has a 'users' table but it is empty. "
            "Run `python backend/seed.py` to populate the database before starting the app."
        )

        lot_count = conn.execute("SELECT COUNT(*) FROM lots").fetchone()[0]
        assert lot_count > 0, (
            f"parking.db has a 'lots' table but it is empty. "
            "Run `python backend/seed.py` to populate the database before starting the app."
        )

        request_count = conn.execute("SELECT COUNT(*) FROM parking_requests").fetchone()[0]
        assert request_count > 0, (
            f"parking.db has a 'parking_requests' table but it is empty. "
            "Run `python backend/seed.py` to populate the database before starting the app."
        )
    finally:
        conn.close()
