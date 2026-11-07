"""
Start-up behaviour that only runs when a module is imported: the SECRET_KEY fail-fast in auth.py and the
AUTO_SEED_DEMO seeding in main.py (used by the Azure demo deployment).

Each check runs in a fresh Python process, because these modules read the environment at import time and the
test process has already imported them with the test configuration.
"""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _run(code: str, env_overrides: dict, drop: tuple = ()) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if k not in drop}
    env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-c", code], cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=120
    )


# ── SECRET_KEY fail-fast ────────────────────────────────────────────────────

# The project .env (if a developer has one) must not leak a key into the "unset" case, so dotenv is disabled.
_NO_DOTENV = "import dotenv; dotenv.load_dotenv = lambda *a, **k: False; "


def test_app_refuses_to_start_without_secret_key():
    result = _run(_NO_DOTENV + "import auth", {}, drop=("SECRET_KEY",))

    assert result.returncode != 0
    assert "SECRET_KEY environment variable is not set" in result.stderr


def test_app_starts_when_secret_key_is_set():
    result = _run(_NO_DOTENV + "import auth", {"SECRET_KEY": "a-test-key-that-is-long-enough-123456"})

    assert result.returncode == 0, result.stderr


# ── AUTO_SEED_DEMO ──────────────────────────────────────────────────────────

def _import_main(tmp_path, auto_seed: str) -> sqlite3.Connection:
    db_file = tmp_path / "startup.db"
    result = _run(
        "import main",
        {
            "SECRET_KEY": "a-test-key-that-is-long-enough-123456",
            "DATABASE_URL": f"sqlite:///{db_file}",
            "AUTO_SEED_DEMO": auto_seed,
            "LOG_DIR": str(tmp_path / "logs"),
        },
    )
    assert result.returncode == 0, result.stderr
    return sqlite3.connect(db_file)


def _count(conn: sqlite3.Connection, table: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def test_empty_database_is_seeded_when_auto_seed_demo_is_true(tmp_path):
    conn = _import_main(tmp_path, "true")
    try:
        assert _count(conn, "users") > 0
        assert _count(conn, "lots") > 0
    finally:
        conn.close()


def test_auto_seed_demo_is_off_by_default(tmp_path):
    conn = _import_main(tmp_path, "")
    try:
        assert _count(conn, "users") == 0
    finally:
        conn.close()


def test_existing_data_is_never_reseeded(tmp_path):
    first = _import_main(tmp_path, "true")
    seeded = _count(first, "users")
    first.execute("DELETE FROM users WHERE id NOT IN (SELECT id FROM users LIMIT 1)")
    first.commit()
    first.close()
    assert seeded > 1

    second = _import_main(tmp_path, "true")  # same DB file: not empty, so it must be left alone
    try:
        assert _count(second, "users") == 1
    finally:
        second.close()
