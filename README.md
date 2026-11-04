# Shared Parking

A corporate parking management system. Users submit parking slot requests; owners approve or reject them and manage their lots; managers administer users and the full system. Built with React 19 and FastAPI, backed by SQLite.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Ant Design v6, react-big-calendar |
| Backend | Python, FastAPI, SQLAlchemy, APScheduler |
| Database | SQLite (`backend/parking.db`) |
| Auth | JWT (python-jose), bcrypt passwords |
| i18n | react-i18next — English, French, Hebrew (RTL) |
| Tests | pytest (backend), Jest + React Testing Library (frontend) |

---

## Features

### Role-Based Access Control
Three roles with distinct capabilities, all derived from the JWT — no manual role selection:

| Role | Access |
|------|--------|
| **User** | Submit requests, view own request history, cancel or edit pending requests |
| **Owner** | All user access + approve/reject requests, manage owned lots, lot calendar view |
| **Manager** | All owner access + admin panel (users, lots, all requests) |

Routes are protected at the routing level; components include internal permission checks for defense-in-depth.

### Parking Requests
- Submit requests with date, time, and duration
- Conflict detection prevents double-booking of the same lot
- Background scheduler (APScheduler) auto-approves conflict-free requests every 15 minutes
- Owners can approve with an optional lot assignment, or reject with a reason
- Requesters can edit or cancel their pending requests
- Per-request message thread between the requester and owners/managers; messages are retained for 7 days after request deletion

### Calendar & Status Views
- **Requests Calendar** — all approved requests in a day/week/month view
- **Lot Calendar** — owner-scoped view of bookings across owned lots
- **Parking Status Board** — visual grid of all lots with live occupancy status; click a spot to see details

### Internationalisation (i18n)
Full EN / FR / HE support across all 12 screens. Language preference is stored per-user in the database — it follows the user across devices and sessions.

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `fr` | Français | LTR |
| `he` | עברית | RTL |

Hebrew switches the entire Ant Design layout to right-to-left via `ConfigProvider direction="rtl"`. Calendar views remain LTR (react-big-calendar has no RTL support).

### User Preferences
Each user has a persisted preferences record:
- **Dark mode** — toggleable from the header
- **Language** — toggleable from the header globe icon
- **Notification windows** — configurable time windows per day of the week

### Mobile Responsive
- Tables switch to card lists on screens narrower than 768 px
- Parking Status Board uses a compact grid on mobile with full-width modals
- Calendar views default to day view on mobile, week on desktop

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+

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

### 2 — Seed the database (first time only)

```bash
cd backend
python seed.py
```

Creates `backend/parking.db` with 21 users, 20 requests, and 17 lots. Re-run at any time to reset to the original sample data.

### 3 — Start the backend

```bash
cd backend
python -m uvicorn main:app --reload
```

- API: **http://localhost:8000**
- Swagger UI: **http://localhost:8000/docs**

To expose the API on your local network (for mobile testing):
```bash
python -m uvicorn main:app --host 0.0.0.0 --reload
```

### 4 — Start the frontend (separate terminal)

```bash
npm start
```

Runs on **http://localhost:3000**. Start the backend first so the API is reachable on load.

### Shutdown

```bash
bash stop.sh
```

Kills processes on ports 8000 and 3000. Works on Windows Git Bash, macOS, and Linux.

---

## Demo Accounts

All accounts use password `password123`.

| Email | Role |
|-------|------|
| `alice@parking.dev` | User |
| `sarah@parking.dev` | Owner |
| `admin@parking.dev` | Manager |

All 21 seeded users follow the `<firstname>@parking.dev` pattern. The login page includes one-click demo account fill buttons.

---

## Running Tests

### Backend (147 tests)

```bash
cd backend
pip install -r requirements-test.txt   # first time only
pytest tests/ -v
pytest tests/ --cov=. --cov-report=term-missing   # with coverage
```

The suite runs against a fresh in-memory SQLite database — it never touches `parking.db`.

| File | Tests | Covers |
|------|-------|--------|
| `test_auth.py` | 9 | Register, login, `/auth/me` |
| `test_requests.py` | 41 | Full CRUD, approve/reject, RBAC, status guards |
| `test_lots.py` | 23 | Full CRUD, `/mine`, `/owner/{name}`, RBAC |
| `test_users.py` | 30 | List, get, update, delete, RBAC, password change, preferences |
| `test_messages.py` | 16 | Send/read messages, RBAC, audit retention after request deletion |

### Frontend

```bash
# CI mode (non-interactive, desktop viewport)
CI=true npm test -- --ci --no-cache
```

---

## Project Structure

```text
shared-parking/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, router registration
│   ├── models.py               # SQLAlchemy models: User, ParkingRequest, Lot, RequestMessage, UserPreferences
│   ├── auth.py                 # JWT utilities, get_current_user, require_owner, require_manager
│   ├── seed.py                 # Seed 21 users, 20 requests, 17 lots
│   ├── requirements.txt        # Production dependencies
│   ├── requirements-test.txt   # Test dependencies
│   ├── routers/
│   │   ├── auth.py             # POST /auth/login, /register  GET /auth/me
│   │   ├── requests.py         # /api/requests/*
│   │   ├── lots.py             # /api/lots/*
│   │   ├── messages.py         # /api/requests/{id}/messages
│   │   └── users.py            # /api/users/* + preferences
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       ├── test_requests.py
│       ├── test_lots.py
│       ├── test_users.py
│       └── test_messages.py
└── src/
    ├── api/                    # Typed fetch wrappers (auto-attach Bearer token, camelCase mapping)
    ├── components/             # All 11 screen components + reusable EmptyState
    ├── contexts/
    │   ├── AuthContext.tsx     # Token storage, login/logout, useAuth() hook
    │   └── RequestsContext.tsx # Global request + lot state
    ├── i18n/
    │   ├── index.ts            # i18next init, isRTL helper, language helpers
    │   ├── en.json             # English strings (12 namespaces)
    │   ├── fr.json             # French strings
    │   └── he.json             # Hebrew strings
    └── utils/
        └── statusUtils.ts      # Centralised status colour/label helpers
```

---

## API Reference

All endpoints except `POST /auth/login` and `POST /auth/register` require:
```
Authorization: Bearer <token>
```

### Auth

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account (always role `user`; managers promote users via `PATCH /api/users/{id}`) |
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
| PATCH | `/api/lots/{id}` | Owner / Manager | Update status or owner |
| DELETE | `/api/lots/{id}` | Manager | Delete lot |

### Messages

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/requests/{id}/messages` | Requester / Owner / Manager | List messages |
| POST | `/api/requests/{id}/messages` | Requester / Owner / Manager | Send a message |

Messages are retained for 7 days after a request is deleted (`request_id` is set to `NULL` rather than cascading).

### Users

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Manager | All users |
| GET | `/api/users/me` | Any | Own profile |
| GET | `/api/users/{id}` | Manager / Self | Get user |
| PATCH | `/api/users/{id}` | Manager / Self | Update (role: manager only) |
| DELETE | `/api/users/{id}` | Manager | Delete user |
| GET | `/api/users/{id}/preferences` | Manager / Self | Get preferences |
| PATCH | `/api/users/{id}/preferences` | Manager / Self | Update preferences |

**Preferences payload:**
```json
{
  "dark_mode": true,
  "language": "fr",
  "notification_windows": "{\"Monday\":[{\"id\":\"1\",\"startTime\":\"09:00\",\"endTime\":\"12:00\"}]}"
}
```

---

## Python Dependencies

### Runtime (`requirements.txt`)

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework — routes, dependency injection, Swagger UI |
| `uvicorn[standard]` | ASGI server; `[standard]` adds auto-reload |
| `sqlalchemy` | ORM — maps models to SQLite tables |
| `pydantic` | Request/response validation |
| `python-jose[cryptography]` | JWT creation and verification (HS256) |
| `bcrypt` | Password hashing (called directly; passlib is incompatible with bcrypt ≥ 4.0) |
| `python-multipart` | Form-data parsing — required by `OAuth2PasswordRequestForm` |
| `apscheduler` | Background scheduler — auto-approves conflict-free requests every 15 minutes |

### Test (`requirements-test.txt`)

| Package | Purpose |
|---------|---------|
| `pytest` | Test runner |
| `httpx` | Required by Starlette's `TestClient` transport layer |
| `pytest-cov` | Coverage reporting (`--cov` flag) |
