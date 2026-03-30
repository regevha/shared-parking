from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine, Base
from routers import requests, lots, auth, users, messages, config

# Create all tables on startup
Base.metadata.create_all(bind=engine)

# ── Lightweight startup migrations (idempotent ALTER TABLE statements) ────────
def _run_migrations() -> None:
    """Add new columns to existing tables without requiring a full reseed."""
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE user_preferences ADD COLUMN notification_windows TEXT DEFAULT '{}'",
            "ALTER TABLE parking_requests ADD COLUMN updated_at TEXT",
            "ALTER TABLE users ADD COLUMN created_at TEXT",
            "ALTER TABLE lots ADD COLUMN created_at TEXT",
            "ALTER TABLE lots ADD COLUMN updated_at TEXT",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists — safe to ignore

_run_migrations()

app = FastAPI(
    title="Parking Management API",
    description="REST API for the parking management mockup",
    version="2.0.0",
)

# Allow the React dev server (port 3000) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(requests.router)
app.include_router(messages.router)
app.include_router(lots.router)
app.include_router(users.router)
app.include_router(config.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "Parking Management API v2"}
