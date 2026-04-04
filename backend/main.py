import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine, Base
from routers import requests, lots, auth, users, messages, config
from scheduler import scheduler

# Create all tables on startup
Base.metadata.create_all(bind=engine)

# ── Lightweight startup migrations (idempotent ALTER TABLE statements) ────────
def _run_migrations() -> None:
    """Add new columns to existing tables without requiring a full reseed."""
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE user_preferences ADD COLUMN notification_windows TEXT DEFAULT '{}'",
            "ALTER TABLE parking_requests ADD COLUMN updated_at TEXT",
            "ALTER TABLE parking_requests ADD COLUMN approved_by TEXT",
            "ALTER TABLE users ADD COLUMN created_at TEXT",
            "ALTER TABLE lots ADD COLUMN created_at TEXT",
            "ALTER TABLE lots ADD COLUMN updated_at TEXT",
            "ALTER TABLE user_preferences ADD COLUMN language TEXT DEFAULT 'en'",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists — safe to ignore

_run_migrations()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Parking Management API",
    description="REST API for the shared parking management app",
    version="2.0.0",
    lifespan=lifespan,
)

# Allow the React dev server (and LAN devices) to call the API.
# In development, all origins are allowed so mobile/LAN access works out of the box.
# Set CORS_ORIGINS env var to restrict in production, e.g.:
#   CORS_ORIGINS=https://parking.example.com
_raw_origins = os.environ.get("CORS_ORIGINS", "")
cors_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
