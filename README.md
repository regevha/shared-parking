# Shared Parking

An application for managing corporate parking resources. Users request parking slots; owners approve or reject requests and manage their lots; managers administer users and lots. Full backend persistence with SQLite, authentication, and audit trail.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Ant Design, react-big-calendar |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | SQLite (`backend/parking.db`) |
| Auth | JWT (python-jose), bcrypt passwords (passlib) |
| i18n | i18next v23 + react-i18next v14 — English, French and Hebrew |
| Tests | pytest, FastAPI TestClient, in-memory SQLite |
| **Audit Trail** | SQLite-backed `audit_log` with timeline UI |
| **RBAC Security** | Centralized route guards & session cleanup |

---

## Security & Authorization Lifecycle

The application implements a robust security model to protect administrative features and ensure session isolation:

### Role-Based Access Control (RBAC)
- **Automatic Guards**: Sensitive routes (e.g., `/admin`) are protected at the routing level in `App.tsx`. Unauthorized users are immediately redirected to the home page.
- **Fail-safe Component Logic**: Components like `AdminPanel.tsx` include internal permission checks to prevent unauthorized rendering, providing defense-in-depth even if navigation logic is bypassed.

### Session Isolation & Cleanup (Verified Fix)
Previously, a "URL leakage" issue existed where the `/admin` path would persist in the browser address bar after an administrator logged out. This could lead to a newly logged-in non-admin user browsing directly to the cached `/admin` URL and potentially viewing cached admin content before the route guard kicked in.

**Resolution:**
- **Centralized Router**: The `BrowserRouter` was moved to the top-level `index.tsx` to ensure it survives the entire session lifecycle.
- **Explicit Logout Navigation**: The `logout` process now explicitly clears the session state and navigates back to the root (`/`), ensuring every new login starts from a clean URL state.

## Key Features (v2.0)

### 🚀 24/7 Multi-Day Bookings
The system now supports round-the-clock booking across multiple days.
- **36-Hour Window**: Requests can span across midnight for a maximum of 36 hours.
- **Auto-Calculated Endings**: Users only need to provide a start time and duration; the system precisely calculates the end date and time.
- **Intelligent Conflict Detection**: Multi-day overlaps are handled correctly at the database level.

### 📜 Robust Audit Trail
Every request carries a complete, immutable history of its lifecycle.
- **Timeline View**: A dedicated "View History" modal shows the full sequence of events (submission, owner approval, auto-approval, cancellation).
- **Transparent Automation**: Actions taken by the background scheduler are explicitly logged.

### 🌍 Hebrew & RTL Support
The application is fully translated into Hebrew, featuring a right-to-left layout and localized parking statistics.

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

Creates `backend/parking.db` with 5 sample users, 3 requests, and 3 lots. Only needed once — data persists across restarts. Re-run to reset to the original sample data.

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

The suite runs **125 tests** against a fresh in-memory SQLite database — it never touches `parking.db`.

| File | Tests | Covers |
|------|-------|--------|
| `tests/test_auth.py` | 9 | Register, login, `/auth/me` |
| `tests/test_requests.py` | 41 | Full CRUD, approve/reject, RBAC, status guards |
| `tests/test_lots.py` | 23 | Full CRUD, `/mine`, `/owner/{name}`, RBAC |
| `tests/test_users.py` | 30 | List, get, update, delete, RBAC, password change, preferences |
| `tests/test_messages.py` | 16 | Send/read messages, RBAC, audit retention after request deletion |

Every endpoint is tested for: success cases · 401 (no/bad token) · 403 (wrong role) · 404 (not found) · 400 (business rule violations) · 422 (validation errors).

---

## Internationalisation (i18n)

The app ships with full English, French and Hebrew support powered by **i18next v23** and **react-i18next v14**.

### Supported languages

| Code | Language | Toggle label |
|------|----------|--------------|
| `en` | English  | 🇬🇧 EN |
| `fr` | Français | 🇫🇷 FR |
| `he` | עברית    | 🇮🇱 HE |

### How it works

- A language toggle button in the header switches between EN and FR instantly.
- All UI text is served through `t('key.path')` calls — no hardcoded English strings in components.
- Translation files use a **nested key structure** grouped by component (e.g. `adminPanel.users.columns.name`).

### Translation files

```
src/i18n/
├── index.ts     # i18next initialisation; getStoredLanguage / storeLanguage helpers
├── en.json      # English strings
└── fr.json      # French strings — real translations, not machine-generated
```

All 12 screen components are fully translated:

| Component | Translation namespace |
|-----------|----------------------|
| `LoginPage` | `login.*` |
| `MyRequests` | `myRequests.*` |
| `AllPendingRequests` | `pendingRequests.*` |
| `AllApprovals` | `approvals.*` |
| `ParkingRequestForm` | `requestForm.*` |
| `RequestDetail` | `requestDetail.*` |
| `LotStatusBoard` | `lotStatusBoard.*` |
| `MyLots` | `myLots.*` |
| `CalendarView` | `calendarView.*` |
| `LotCalendarView` | `lotCalendarView.*` |
| `NotificationWindows` | `notificationWindows.*` |
| `AdminPanel` | `adminPanel.*` |

### Language preference persistence

Language preference is stored in the **database** in the `user_preferences` table (same pattern as dark mode):

- **On toggle:** `PATCH /api/users/{id}/preferences` is called with `{ language: 'fr' }` (fire-and-forget — the UI updates immediately without waiting for the network).
- **On login:** The stored language is read from `user.preferences.language` returned by `/auth/me` and applied to i18next before the app shell renders. This means a user's language follows them across devices.
- **Fallback:** `localStorage` (`parking_language` key) is kept in sync as a fast-read cache; it is always overwritten by the value from the DB on login.

---

## The project follows a standard React + FastAPI structure:

```text
shared-parking/
├── backend/               # FastAPI Python application
│   ├── main.py            # API endpoints & app setup+ CORS + router registration
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
    │   ├── auth.ts           # Login / me API calls + UserPreferences type
    │   ├── requests.ts       # Parking request API calls
    │   ├── lots.ts           # Lots API calls
    │   ├── messages.ts       # Request message API calls
    │   └── users.ts          # Users API calls + preferences PATCH
    ├── components/           # Screen components (all 12 fully translated)
    ├── contexts/
    │   ├── AuthContext.tsx   # Token storage, login/logout, useAuth() hook
    │   └── RequestsContext.tsx  # Global request + lot state, loaded from API
    ├── i18n/
    │   ├── index.ts          # i18next init, getStoredLanguage/storeLanguage helpers
    │   ├── en.json           # English translation strings (nested key structure)
    │   └── fr.json           # French translation strings
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
| GET | `/api/requests/{id}/audit` | Requester / Manager | View request audit history |

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
| GET | `/api/users/{id}/preferences` | Manager / Self | Get preferences |
| PATCH | `/api/users/{id}/preferences` | Manager / Self | Update preferences |

### Config

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/config` | Any | Global system constants (booking windows) |
| POST | `/api/requests/run-auto-approve` | Manager | Trigger the auto-approval scheduler |

**Preferences payload** (`PATCH /api/users/{id}/preferences`):

```json
{
  "dark_mode": true,
  "language": "fr",
  "notification_windows": "{\"Monday\":[{\"id\":\"1\",\"startTime\":\"09:00\",\"endTime\":\"12:00\"}]}"
}
```

---

## Future Roadmap / Advanced Testing

The following areas are slated for further refinement and robust stress testing:
- **🕒 DST Transitions**: Verifying 24/7 multi-day logic during "spring forward" and "fall back".
- **🛡️ Scheduler Stress**: Handling lot depletion and race conditions during bulk auto-approvals.
- **🌐 Visual RTL Audit**: Automated screenshot testing for the Hebrew mobile experience.
- **📜 Detailed Audit Diffs**: Storing field-level changes (e.g., specific updated fields) in the `AuditLog`.

See **[TODO.md](TODO.md)** for the full technical task list.
