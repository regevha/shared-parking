import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# ── Load Env & Logging ────────────────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Ensure logs directory exists
_log_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
if not os.path.exists(_log_dir):
    os.makedirs(_log_dir)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(_log_dir, "parking.log"))
    ]
)
logger = logging.getLogger("parking-api")
logger.info("API Starting Up...")

from database import engine, Base
from routers import auth, requests, lots, messages, users, config, notifications, admin, availability
from scheduler import scheduler

# Create all tables on startup
Base.metadata.create_all(bind=engine)

# ── Lightweight startup migrations (idempotent ALTER TABLE/CREATE statements) ─
def _run_migrations() -> None:
    """Add new columns/tables to existing databases without requiring a full reseed."""
    with engine.connect() as conn:
        migrations = [
            "CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, message TEXT NOT NULL, is_read BOOLEAN DEFAULT 0, created_at TEXT NOT NULL)",
            "ALTER TABLE user_preferences ADD COLUMN notification_windows TEXT DEFAULT '{}'",
            "ALTER TABLE user_preferences ADD COLUMN availability_windows TEXT DEFAULT '{}'",
            "ALTER TABLE parking_requests ADD COLUMN updated_at TEXT",
            "ALTER TABLE parking_requests ADD COLUMN approved_by TEXT",
            "ALTER TABLE users ADD COLUMN created_at TEXT",
            "ALTER TABLE lots ADD COLUMN created_at TEXT",
            "ALTER TABLE lots ADD COLUMN updated_at TEXT",
            "ALTER TABLE user_preferences ADD COLUMN language TEXT DEFAULT 'en'",
            "ALTER TABLE parking_requests ADD COLUMN requester_role TEXT",
            (
                "CREATE TABLE IF NOT EXISTS lot_availability_windows ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "lot_id TEXT NOT NULL REFERENCES lots(id) ON DELETE CASCADE, "
                "day_of_week INTEGER, "
                "specific_date TEXT, "
                "start_time TEXT NOT NULL, "
                "end_time TEXT NOT NULL, "
                "is_active BOOLEAN NOT NULL DEFAULT 1, "
                "created_at TEXT)"
            ),
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                msg = str(e).lower()
                if "already exists" in msg or "duplicate column name" in msg:
                    pass  # expected for idempotent migrations — safe to ignore
                else:
                    logger.error(f"Migration failed: {e}", exc_info=True)
                    raise

_run_migrations()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()


DEBUG = os.environ.get("DEBUG", "true").lower() == "true"

app = FastAPI(
    title="Parking Management API",
    description="REST API for the shared parking management app",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
    openapi_url="/openapi.json" if DEBUG else None,
)

# Allow the React dev server (and LAN devices) to call the API.
# In development, all origins are allowed so mobile/LAN access works out of the box.
# Set CORS_ORIGINS env var to restrict in production, e.g.:
#   CORS_ORIGINS=https://parking.example.com
_raw_origins = os.environ.get("CORS_ORIGINS", "")
cors_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins else ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

app.include_router(auth.router)
app.include_router(requests.router)
app.include_router(messages.router)
app.include_router(lots.router)
app.include_router(users.router)
app.include_router(config.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(availability.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "Parking Management API v2"}
