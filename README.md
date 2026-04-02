# Parking Management Mockup

A React + Python parking management system. Users request parking slots; owners approve or reject requests and manage their lots; managers administer users and lots. Authentication uses JWT.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Ant Design, react-big-calendar |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | SQLite (`backend/parking.db`) |
| Auth | JWT (python-jose), bcrypt passwords (passlib) |
| Tests | pytest, FastAPI TestClient, in-memory SQLite |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+

---

### 1 — Install dependencies

**Frontend**
```bash
npm install
```

**Backend**
```bash
cd backend
pip install -r requirements.txt
```

---

### 2 — Seed the database (first time only)

```bash
cd backend
python seed.py
```

Creates `backend/parking.db` with 21 sample users, 20 requests, and 17 lots. Only needed once — data persists across restarts. Re-run to reset to the original sample data.

**Demo accounts** (password: `password123`):

| Email | Role |
|-------|------|
| `alice@parking.dev` | User |
| `sarah@parking.dev` | Owner |
| `admin@parking.dev` | Manager |

All 21 users follow the `<firstname>@parking.dev` pattern.

---

### 3 — Start the backend

```bash
cd backend
python -m uvicorn main:app --reload
```

- API: **http://localhost:8000**
- Swagger UI: **http://localhost:8000/docs**

---

### 4 — Start the frontend (separate terminal)

```bash
npm start
```

Runs on **http://localhost:3000** — start the backend first so the API is reachable on load.

---

## Mobile / Local Network Access

Both servers are configured to bind to all interfaces so you can open the app on a phone or tablet connected to the same WiFi.

1. Find your machine's LAN IP: run `ipconfig` (Windows) or `ip addr` (Linux/Mac) and note the IPv4 address.
2. Start the backend with `--host 0.0.0.0` (see below) and set `CORS_ORIGINS` to include your LAN IP.
3. Start the frontend — the `.env` file already sets `HOST=0.0.0.0`.
4. Open `http://<LAN-IP>:3000` on your phone.

Full instructions: **[docs/MOBILE_ACCESS.md](docs/MOBILE_ACCESS.md)**

---

## Python Dependencies

### Runtime packages (`requirements.txt`)

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework — defines routes, validates requests/responses, generates Swagger docs |
| `uvicorn[standard]` | ASGI server that runs FastAPI. `[standard]` adds WebSocket support and auto-reload |
| `sqlalchemy` | ORM — maps `User`, `ParkingRequest`, `Lot` Python classes to SQLite tables |
| `pydantic` | Data validation — powers all request schemas (`LotCreate`, `UserUpdate`, etc.) and response models |
| `python-jose[cryptography]` | Creates and verifies JWT tokens issued at login. `[cryptography]` provides the HS256 signing backend |
| `bcrypt` | Password hashing — `hash_password()` and `verify_password()` in `auth.py` call bcrypt directly (passlib dropped — incompatible with bcrypt ≥ 4.0) |
| `python-multipart` | Form-data parser — **required** by FastAPI's `OAuth2PasswordRequestForm`; the `/auth/login` endpoint receives `username`/`password` as form fields, not JSON |

### Test packages (`requirements-test.txt`)

| Package | Purpose |
|---------|---------|
| `pytest` | Test runner — discovers and executes all `test_*.py` files |
| `httpx` | HTTP client — required by Starlette's `TestClient` transport layer (must be installed even though you never call it directly) |
| `pytest-cov` | Coverage plugin — enables `pytest --cov=. --cov-report=term-missing` |

---

## Running Tests

```bash
cd backend
pip install -r requirements-test.txt   # first time only
pytest tests/ -v
```

With coverage report:
```bash
pytest tests/ --cov=. --cov-report=term-missing
```

The suite runs **119 tests** against a fresh in-memory SQLite database — it never touches `parking.db`.

| File | Tests | Covers |
|------|-------|--------|
| `tests/test_auth.py` | 9 | Register, login, `/auth/me` |
| `tests/test_requests.py` | 41 | Full CRUD, approve/reject, RBAC, status guards |
| `tests/test_lots.py` | 23 | Full CRUD, `/mine`, `/owner/{name}`, RBAC |
| `tests/test_users.py` | 30 | List, get, update, delete, RBAC, password change, preferences |
| `tests/test_messages.py` | 16 | Send/read messages, RBAC, audit retention after request deletion |

Every endpoint is tested for: success cases · 401 (no/bad token) · 403 (wrong role) · 404 (not found) · 400 (business rule violations) · 422 (validation errors).


---

## Project Structure

```
parking-mockup/
├── backend/
│   ├── main.py               # FastAPI app + CORS + router registration
│   ├── database.py           # SQLite connection (SQLAlchemy)
│   ├── models.py             # User, ParkingRequest, Lot table definitions
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── auth.py               # JWT utilities, get_current_user, require_owner/manager
│   ├── seed.py               # Populate DB with sample users, requests, lots
│   ├── requirements.txt      # Production dependencies
│   ├── requirements-test.txt # Test dependencies (pytest, httpx, coverage)
│   ├── routers/
│   │   ├── auth.py           # POST /auth/login, /register  GET /auth/me
│   │   ├── requests.py       # /api/requests endpoints
│   │   ├── lots.py           # /api/lots endpoints
│   │   ├── messages.py       # /api/requests/{id}/messages endpoints
│   │   └── users.py          # /api/users endpoints
│   └── tests/
│       ├── conftest.py       # Fixtures: in-memory DB, TestClient, auth helpers
│       ├── test_auth.py
│       ├── test_requests.py
│       ├── test_lots.py
│       ├── test_users.py
│       └── test_messages.py
└── src/
    ├── api/
    │   ├── client.ts         # Base fetch wrapper (auto-attaches Bearer token)
    │   ├── auth.ts           # Login / me API calls
    │   ├── requests.ts       # Parking request API calls
    │   ├── lots.ts           # Lots API calls
    │   ├── messages.ts       # Request message API calls
    │   └── users.ts          # Users API calls
    ├── components/           # Screen components
    ├── contexts/
    │   ├── AuthContext.tsx   # Token storage, login/logout, useAuth() hook
    │   └── RequestsContext.tsx  # Global request + lot state, loaded from API
    ├── utils/
    │   └── statusUtils.ts    # Centralised status colour/label helpers
    └── types/
        └── index.ts          # Shared TypeScript types
```

---

## API Reference

All endpoints (except `POST /auth/login` and `POST /auth/register`) require:
```
Authorization: Bearer <token>
```

### Auth

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Sign in, returns JWT |
| GET | `/auth/me` | Any | Current user profile |

### Parking Requests

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/requests` | Any | All requests |
| GET | `/api/requests/pending` | Any | Pending only |
| GET | `/api/requests/approved` | Any | Approved only |
| GET | `/api/requests/me` | Any | Current user's requests |
| POST | `/api/requests` | Any | Submit new request |
| PATCH | `/api/requests/{id}/approve` | Owner | Approve (optionally assign lot) |
| PATCH | `/api/requests/{id}/reject` | Owner | Reject |
| PATCH | `/api/requests/{id}` | Requester | Edit date/time (pending only) |
| DELETE | `/api/requests/{id}` | Requester | Cancel |

### Lots

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/lots` | Any | All lots |
| GET | `/api/lots/mine` | Owner | Current owner's lots |
| GET | `/api/lots/owner/{name}` | Any | Lots by owner name |
| GET | `/api/lots/{id}` | Any | Single lot |
| POST | `/api/lots` | Manager | Create lot |
| PATCH | `/api/lots/{id}` | Owner / Manager | Update status/owner |
| DELETE | `/api/lots/{id}` | Manager | Delete lot |

### Messages

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/requests/{id}/messages` | Requester / Owner / Manager | List messages for a request |
| POST | `/api/requests/{id}/messages` | Requester / Owner / Manager | Send a message on a request |

Messages survive request deletion for auditing — `request_id` is set to `NULL` rather than cascading.

### Users

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Manager | All users |
| GET | `/api/users/me` | Any | Own profile |
| GET | `/api/users/{id}` | Manager / Self | Get user |
| PATCH | `/api/users/{id}` | Manager / Self | Update (role: manager only) |
| DELETE | `/api/users/{id}` | Manager | Delete user |
