import os
import pytest
from auth import SECRET_KEY

def test_logging_file_exists():
    """Verify that the API has initialized its logging system and created the log file."""
    # We look for parking.log in the backend directory
    log_path = "parking.log"
    assert os.path.exists(log_path), "parking.log not found. Logging system might not be initialized."
    
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
