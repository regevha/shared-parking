# CLAUDE.md — Shared Parking Project

## Project Overview
A React + FastAPI parking management system. Users request parking slots; owners approve/reject; managers administer. Data is persisted in SQLite via SQLAlchemy. Authentication uses JWT (bcrypt passwords, 8-hour tokens).

## Tech Stack
### Frontend
- **React 19** + **TypeScript** + **Create React App**
- **Ant Design (antd v6)** — UI components; RTL via `ConfigProvider direction="rtl"`
- **react-big-calendar** with `dayjsLocalizer` — calendar views (day/week/month); LTR-only (no RTL support in library)
- **react-router-dom** — routing
- **dayjs** — date formatting; locale activated via `dayjs.locale(lang)` on language change
- **react-i18next** + **i18next** — internationalisation (EN / FR / HE)

### Backend
- **FastAPI** + **uvicorn** — REST API on port 8000
- **SQLAlchemy** + **SQLite** — ORM + database (`parking.db`)
- **pydantic v2** — request/response schemas
- **python-jose[cryptography]** — JWT signing (HS256)
- **bcrypt** — password hashing (called directly; passlib dropped — incompatible with bcrypt ≥ 4.0)
- **python-multipart** — form-data parsing for OAuth2 login

## Authentication
- Login via `POST /auth/login` (form-encoded: `username` = email, `password`)
- JWT stored in `localStorage` under key `parking_token`
- All API requests attach `Authorization: Bearer <token>` (via `src/api/client.ts`)
- `src/contexts/AuthContext.tsx` — manages `user`, `token`, `authLoading`, `login()`, `logout()`
- On app load: validates stored token via `GET /auth/me`
- `LoginPage.tsx` shown when unauthenticated; includes quick-fill demo account tags

## Roles
Backend role strings → frontend `Role` type mapping:
| Backend | Frontend | Access |
|---------|----------|--------|
| `user` | `User` | My Requests, submit new request |
| `owner` | `Owner` | + approve/reject, Lot Calendar, My Lots |
| `manager` | `Manager` | + Admin Panel |

Role is derived from the JWT — no manual dropdown.

## Demo Accounts (password: `password123`)
| Email | Role |
|-------|------|
| `alice@parking.dev` | User |
| `sarah@parking.dev` | Owner |
| `admin@parking.dev` | Manager |
All 21 users follow `<firstname>@parking.dev` pattern. See `seed.py` for the full list.

## Python Libraries

### Runtime packages (`backend/requirements.txt`)
| Package | Why it's needed |
|---------|----------------|
| `fastapi` | Web framework — routes, dependency injection, automatic Swagger UI |
| `uvicorn[standard]` | ASGI server that runs FastAPI; `[standard]` adds auto-reload and WebSocket support |
| `sqlalchemy` | ORM — maps `User`, `ParkingRequest`, `Lot` to SQLite tables; handles all queries |
| `pydantic` | Request/response validation — all schemas (`LotCreate`, `ApprovePayload`, etc.) |
| `python-jose[cryptography]` | JWT creation and verification (`create_access_token`, `get_current_user`) |
| `bcrypt` | Password hashing — `hash_password()` / `verify_password()` in `auth.py` call bcrypt directly (passlib dropped — incompatible with bcrypt ≥ 4.0) |
| `python-multipart` | Form-data parsing — **required** for `OAuth2PasswordRequestForm` on `POST /auth/login` |
| `apscheduler` | Background job execution (auto-approves conflict-free parking requests every 15 mins) |

### Test packages (`backend/requirements-test.txt`)
| Package | Why it's needed |
|---------|----------------|
| `pytest` | Test runner — discovers `test_*.py`, runs fixtures, reports results |
| `httpx` | Starlette's `TestClient` uses httpx as its transport layer internally |
| `pytest-cov` | Enables `--cov` flag for line-level coverage reports |

## Startup
```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py        # first time only — data persists in parking.db
uvicorn main:app --reload

# Frontend (separate terminal)
npm install
npm start
```

## Running Tests
```bash
cd backend
pip install -r requirements-test.txt   # first time only
pytest tests/ -v
pytest tests/ --cov=. --cov-report=term-missing  # with coverage
```
- 119 tests, always green
- Uses in-memory SQLite (StaticPool) — never touches parking.db
- Isolation mechanism: `conftest.py` uses FastAPI's `app.dependency_overrides[get_db] = override_get_db` to replace the real `get_db` (which opens `parking.db`) with a version that yields an in-memory session instead. Every endpoint uses `Depends(get_db)`, so the swap is transparent — the app code runs unchanged but all DB operations go to the throwaway in-memory database.

## Key Files

### Internationalisation (i18n)
- `src/i18n/index.ts` — i18next init; `SupportedLanguage` type (`'en' | 'fr' | 'he'`); `SUPPORTED_LANGUAGES` array (with `nativeLabel`); `isRTL(lang)` helper; `getStoredLanguage()` / `storeLanguage()`
- `src/i18n/en.json` — English translations (12 namespaces: nav, common, login, myRequests, pendingRequests, approvals, requestForm, requestDetail, notificationWindows, adminPanel, calendarView, lotCalendarView, lotStatusBoard, myLots, app)
- `src/i18n/fr.json` — French translations (same 12 namespaces)
- `src/i18n/he.json` — Hebrew translations (same 12 namespaces; RTL)
- Language is persisted in `localStorage` (`parking_language`) and synced to/from the DB (`UserPreferences.language`)
- `App.tsx` — `ConfigProvider direction="rtl"` when Hebrew; `useLayoutEffect` syncs `<html dir>` and `<html lang>`; language dropdown in header (globe icon); `dayjs.locale()` activated on change
- react-big-calendar is LTR-only — left as-is with explanatory comment in CalendarView/LotCalendarView

### Auth Layer
- `src/api/auth.ts` — `authApi.login()` (form-encoded) + `authApi.me()`
- `src/contexts/AuthContext.tsx` — token/user state, `useAuth()` hook
- `src/components/LoginPage.tsx` — login form with demo account tags
- `src/api/client.ts` — `api.get/post/patch/delete` helpers; auto-attaches Bearer token

### State / Data
- `src/contexts/RequestsContext.tsx` — all request + lot state, loaded from API via `useAuth`
  - `pendingRequests`, `approvedRequests`, `userRequests` (current user's own)
  - `allLots` (all 17 lots), `ownerLots` (server-scoped to owner role)
  - `approveRequest(id, lotInfo?)`, `rejectRequest(id)`, `cancelUserRequest(id)`, `updateUserRequest(id, updates)`
- `src/api/requests.ts` — `requestsApi.*` — maps snake_case ↔ camelCase
- `src/api/lots.ts` — `lotsApi.*`
- `src/api/messages.ts` — `messagesApi.getForRequest(id)` + `messagesApi.send(id, text)`; maps snake_case ↔ camelCase
- `src/utils/statusUtils.ts` — centralised colour/label helpers: `getStatusColor`, `getStatusLabel`, `getLotStatusTagColor`, `getRequestStatusColor`, `getRequestStatusLabel`

### Backend
- `backend/main.py` — FastAPI app, CORS, router registration
- `backend/models.py` — `User`, `UserPreferences`, `ParkingRequest`, `Lot`, `RequestMessage` SQLAlchemy models
  - `UserPreferences`: `ondelete="CASCADE"` (preferences have no meaning without the owner); columns: `dark_mode`, `notification_windows` (JSON), `language` (allowlist: `en|fr|he`)
  - `RequestMessage.request_id`: nullable, `ondelete="SET NULL"` — messages are preserved for 7-day audit retention after a request is deleted; FK is nulled explicitly in `delete_request()` because SQLite does not enforce FK actions without `PRAGMA foreign_keys=ON`
- `backend/auth.py` — JWT utilities, `get_current_user`, `require_owner`, `require_manager`
- `backend/routers/auth.py` — `/auth/login`, `/auth/register`, `/auth/me`
- `backend/routers/requests.py` — `/api/requests/*`
- `backend/routers/lots.py` — `/api/lots/*` (CRUD, owner-scoped `/mine`)
- `backend/routers/messages.py` — `/api/requests/{id}/messages` (GET + POST); access: requester or any owner/manager
- `backend/routers/users.py` — `/api/users/*` (CRUD, manager/self restrictions); `/api/users/{id}/preferences` (GET/PATCH)
- `backend/seed.py` — seeds 21 users, 20 requests, 17 lots
- `backend/requirements.txt` — production dependencies
- `backend/requirements-test.txt` — test dependencies (`pytest`, `httpx`, `pytest-cov`)

### Tests
- `backend/tests/conftest.py` — fixtures: in-memory SQLite (StaticPool), TestClient with `get_db` override, `user_headers` / `owner_headers` / `manager_headers`, `created_request_id`, `created_lot_id`, `owner_lot_id`; patches `pwd_context` to `sha256_crypt`
- `backend/tests/test_auth.py` — 9 tests: register, login, `/auth/me`
- `backend/tests/test_requests.py` — 41 tests: full CRUD, approve/reject, RBAC, status guards
- `backend/tests/test_lots.py` — 23 tests: full CRUD, `/mine`, `/owner/{name}`, dual-role PATCH
- `backend/tests/test_users.py` — 30 tests: list, get, update, delete, role restrictions, password change, self-delete prevention
- `backend/tests/test_messages.py` — 16 tests: send/read messages, RBAC, audit retention (messages preserved with `request_id=NULL` after request deletion)

### Screens
| File | Route | Menu Label |
|------|-------|------------|
| `MyRequests.tsx` | `/my-requests` | My Requests |
| `CalendarView.tsx` | `/calendar` | Requests View |
| `AllPendingRequests.tsx` | `/pending` | Pending Requests |
| `AllApprovals.tsx` | `/approvals` | Approvals |
| `LotStatusBoard.tsx` | `/lot-status` | Parking Status |
| `LotCalendarView.tsx` | `/lot-calendar` | Lot Calendar (Owner only) |
| `MyLots.tsx` | `/my-lots` | My Lots (Owner only) |
| `AdminPanel.tsx` | `/admin` | Admin Panel (Manager only) |
| `NotificationWindows.tsx` | `/notifications` | Notification Windows |
| `ParkingRequestForm.tsx` | `/submit-request` | (via "+ New Request" button) |
| `RequestDetail.tsx` | `/request/:id` | (navigated to from request rows) |

### Styles
- `src/components/CalendarView.css` — shared by CalendarView and LotCalendarView
- `src/components/LotCalendarView.css` — lot calendar specific
- `src/components/AllApprovals.css` — `.owner-approval-row` highlight
- `src/components/MyRequests.css` — mobile card list styles
- `src/index.css` — global CSS variables (dark/light theme)

## Conventions

### Info Banners
Every screen has an info banner **at the bottom** (below stats):
```tsx
<Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>
  <strong>Screen Name:</strong> One sentence describing the purpose.
</Card>
```
`LotStatusBoard` uses `<Alert>` instead.

### Stats / Totals
Summary stat cards appear **at the bottom**, above the info banner.

### Pagination
Always use `pagination={{ pageSize: 10, hideOnSinglePage: true }}` on all Tables.

### Mobile Responsiveness
- `window.matchMedia('(max-width: 768px)')` with `useEffect` listener
- `MyRequests` uses card list on mobile
- Calendars default to `day` view on mobile, `week` on desktop

### Calendar Settings
Both `CalendarView` and `LotCalendarView`:
- `step={60}` + `timeslots={1}` — 1-hour slots
- `min` = 07:00, `max` = 20:00, `scrollToTime` = 08:00
- `slotPropGetter` highlights current hour (`rgba(22, 119, 255, 0.18)`)
- `.rbc-current-time-indicator { display: none }` — thin line hidden

### Row Highlighting
`AllApprovals` highlights rows where `lotOwner === user?.name` (from `useAuth`) using `.owner-approval-row`.

## Git / Branching
- Main branch: `master`
- **Never commit directly to `master`.** Always create a feature branch for any change, no matter how small, and open a PR to merge it.
- Branch naming convention: `feature/<short-description>` (e.g. `feature/messages-api`, `feature/error-handling`)
- Current branch: `master`

## Pending TODOs
1. Improve overlapping events display — hover tooltip for narrow calendar events
2. Empty state UI for all tables (currently shows empty table when no data)
3. Audit trail — `created_at` / `updated_at` timestamps on records (timestamps added to DB; full audit trail UI pending)
4. RTL layout for react-big-calendar — library has no RTL support; calendar stays LTR even in Hebrew mode
