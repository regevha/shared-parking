# Stage 6 — Technical Architecture

Textual architecture description for architect review. No diagrams — structured descriptions mirror what a diagram would convey.

---

## System Context (textual "context diagram")

**Human actors**:
- *Requester* — any authenticated user; interacts via web UI.
- *Lot Owner* — authenticated user with the `owner` role.
- *Manager* — authenticated user with administrative privileges.

**System actor**:
- *Auto-Scheduler* — internal APScheduler thread that promotes eligible pending requests.

**External systems**:
- None in the current implementation. No email/SMS/calendar integrations; notifications are in-app only.
- JWT is self-contained (HS256 with local secret); no external identity provider.

**System boundary**: A single deployable unit containing:
- React SPA (built via CRA, served statically in dev by Webpack dev server).
- FastAPI application (uvicorn ASGI server).
- SQLite database file (`parking.db`) co-located with the backend.
- APScheduler running in-process with FastAPI.

---

## Container View (textual)

Four logical containers in one runtime host:

1. **Web Client (Container: Browser SPA)**
   - Stack: React 19, TypeScript, Ant Design v6, react-router, react-big-calendar, dayjs, i18next.
   - Responsibilities: Rendering, form handling, client-side validation, language/theme preferences, calendar UI, mobile layout, optimistic updates on mutations.
   - Persistent client state: `localStorage` (`parking_token`, `parking_language`).

2. **API Server (Container: FastAPI + uvicorn)**
   - Stack: FastAPI, Pydantic v2, SQLAlchemy 2.x, python-jose, bcrypt.
   - Responsibilities: Request validation, authorization, business-rule enforcement, persistence, audit logging, notification fan-out.
   - Exposes REST API on port 8000.

3. **Background Scheduler (Container: APScheduler, in-process)**
   - Stack: `apscheduler.schedulers.background.BackgroundScheduler`.
   - Runs the auto-approval job on a 15-min interval.
   - Uses a fresh SQLAlchemy session per run.

4. **Database (Container: SQLite file)**
   - SQLAlchemy ORM handles schema creation and light migrations.
   - File lives under `backend/parking.db`.

---

## Component View — Backend

### Entry Point
- `main.py`: initialises logging, loads `.env`, creates schema, runs idempotent migrations, starts scheduler in FastAPI lifespan, mounts routers.

### Auth Layer
- `auth.py`: password hashing (bcrypt direct), JWT issuance/verification, dependency callables (`get_current_user`, `require_owner`, `require_manager`).
- Secret strictly required via `SECRET_KEY` env var — fail-fast if missing.

### Domain Layer (Models)
- `models.py`: all SQLAlchemy ORM classes and domain enums.
- `database.py`: engine, session factory, `get_db` dependency.
- `schemas.py`: Pydantic request/response schemas with field validators and `model_validator` for multi-field rules.

### Application Layer (Routers)
- Each router owns one aggregate (auth, requests, lots, messages, users, notifications, config, admin).
- Shared cross-cutting helpers live in `routers/requests.py`:
  - `_generate_id` — sequential request IDs.
  - `_add_audit_log` — unified audit writer.
  - `_create_notification` — fire-and-forget inbox insert.
  - `_has_conflict`, `_is_outside_availability` — reused by scheduler.

### Scheduling Layer
- `scheduler.py`: `run_auto_approval` operates on a DB session (injectable for tests). Interval is env-configurable.
- Exposed manually via `POST /api/config/run-auto-approval` and `POST /api/requests/run-auto-approve`.

### Infrastructure
- Logging to `logs/parking.log` + stdout. Logger name `parking-api`.
- CORS: permissive by default (`*`); tightened via `CORS_ORIGINS` env var.

---

## Component View — Frontend

### Providers (top-down)
- `AuthProvider` — token + user + login/logout/updateUser, validates token on mount.
- `ConfigProvider` (Ant Design) — theme + locale + direction.
- `RequestsProvider` — request/lot state, loads on user change.
- `Router` — routes under `<AppShell>`.

### Shell
- `AppShell` (in `App.tsx`) — menu building, language dropdown, theme toggle, notifications bell, mobile drawer. Menu items depend on role.

### Screens (by concern)
| Concern | Screens |
|---|---|
| Requester | MyRequests, ParkingRequestForm, RequestDetail |
| Owner | MyLots, LotCalendarView |
| Shared ops | AllPendingRequests, AllApprovals, CalendarView, LotStatusBoard |
| Manager | AdminPanel |
| Personal | AvailabilityWindows, NotificationWindows |

### Data Access
- `src/api/client.ts` — thin `fetch` wrapper auto-attaching `Authorization`; unified error throw.
- `src/api/{auth,requests,lots,users,messages,notifications,config,admin}.ts` — typed API modules that translate snake_case ↔ camelCase.

### Cross-Cutting
- `i18n/index.ts` — language init, persistence, helpers.
- `types/enums.ts` — shared enums (UserRole, RequestStatus).
- `utils/statusUtils.ts` — centralised colour/label helpers.

---

## Data Flow — Representative Sequences (textual)

### S1 — Login
1. Browser → `POST /auth/login` form data.
2. Backend verifies password (bcrypt), issues JWT, returns token + preferences.
3. Browser stores token, calls `GET /auth/me` on subsequent loads to hydrate user.
4. All subsequent requests include `Authorization: Bearer <token>`.

### S2 — Create Request
1. Form validates → `POST /api/requests` with `{date, start_time, duration, end_date?, end_time?}`.
2. Pydantic validators enforce format, duration, past-date, end-time consistency.
3. `create_request` re-checks pending cap, inserts row, writes audit log, commits.
4. Frontend optimistically adds the returned record to both `pendingRequests` and `userRequests`.

### S3 — Auto-Approval Tick
1. Scheduler thread wakes every 15 min, opens DB session.
2. Loads pending requests ordered by `submitted_at`.
3. For each request: iterates candidate lots, applies conflict and availability checks.
4. On match: mutates request, writes audit + notification, commits; continues.
5. Closes session.

### S4 — Approve / Reject
1. Owner clicks action in Pending list.
2. `PATCH /api/requests/{id}/approve` or `/reject`.
3. Backend mutates status, writes audit + notification.
4. Frontend removes from pending, adds to approved (approve) or updates in place (reject).

### S5 — Send Message
1. `POST /api/requests/{id}/messages`.
2. Access check: requester OR any owner OR manager.
3. Insert message with denormalised sender fields.
4. Frontend appends to the local thread.

### S6 — Language Change
1. User picks a language from header dropdown.
2. i18next reloads, `dayjs.locale` set, `<html lang/dir>` updated.
3. localStorage key `parking_language` updated.
4. `PATCH /api/users/{id}/preferences` fires-and-forgets to persist.

---

## Cross-Cutting Concerns

### Validation Strategy
- Client-side: Ant Design form rules + inline checks (fast feedback).
- Server-side: Pydantic schemas with field and model validators (authoritative).
- Authoritative source for all rules is the server.

### Error Handling
- Backend: `HTTPException` with canonical codes (400 validation, 401 auth, 403 role, 404 missing, 409 conflict).
- Frontend: API client throws on non-OK; screens surface via Ant Design `message.error` / alerts.

### Observability
- Centralised logging via Python `logging`. All auth failures, audit access denials, and scheduler actions are logged.
- No metrics or tracing in the current implementation.

### Concurrency
- Auto-scheduler opens its own session; manual approvals use request-scoped sessions.
- No explicit row-level locking. Race conditions between manual and auto approval are possible but narrow (conflict check is done inside the transaction).

### Configuration
- `.env` at repo root (loaded via `python-dotenv`).
- Key env vars:
  - `SECRET_KEY` (required)
  - `ALGORITHM` (default HS256)
  - `ACCESS_TOKEN_EXPIRE_MINUTES` (default 480)
  - `AUTO_APPROVE_INTERVAL_MINUTES` (default 15)
  - `MAX_PENDING_REQUESTS` (default 5)
  - `MIN_REQUEST_DURATION_HOURS` / `MAX_REQUEST_DURATION_HOURS` (default 1 / 36)
  - `CANCELLATION_WINDOW_HOURS` (default 2)
  - `CORS_ORIGINS` (default `*`)
  - `BLACKOUT_START`, `BLACKOUT_END`, `TIMEZONE` — exposed via config endpoint.

---

## Deployment Shape (current dev setup)

- **Backend**: `uvicorn main:app --host 0.0.0.0 --reload` on port 8000.
- **Frontend**: CRA dev server on port 3000.
- **DB**: SQLite file `backend/parking.db`.
- **LAN access**: both servers bind `0.0.0.0` so mobile devices on the same network can reach them.
- **Production notes (for new project)**: SQLite is adequate for prototyping; production should move to Postgres (concurrency, FK enforcement, migrations). CORS origins must be restricted. JWT secret must be rotated and sourced from a secure store.

---

## Architecture Characteristics

### Strengths
- Small, clear module boundaries — easy to reason about.
- Two-tier approval (auto + manual) with sensible override semantics.
- Audit trail survives deletions — enables compliance-like flows.
- Preferences drive real backend logic (availability → scheduler), not just UI state.

### Known Weaknesses / Anti-patterns
- Denormalised fields on `ParkingRequest` (`requester_name`, `lot_owner`, etc.) require consistency care on updates.
- No FK enforcement at SQLite level — behaviour depends on application logic.
- Hand-rolled migrations in `main.py` (brittle beyond a few changes) — new project should adopt Alembic or equivalent.
- `get_all_requests` is a manager-only "list everything" endpoint with no pagination.
- Notifications have no retention policy.

### Extension Points
- Adding a new entity → new model + schema + router + API module + screen.
- Adding a new role → extend `UserRole`, add guard in `auth.py`, update matrix.
- Adding a notification channel (email/SMS) → adapter around `_create_notification`.
- Adding a new approval policy → plug into scheduler predicate chain alongside `_has_conflict` / `_is_outside_availability`.
