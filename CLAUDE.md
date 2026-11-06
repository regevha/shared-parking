# CLAUDE.md — Shared Parking Project

## Project Overview
A React + FastAPI parking management system. Users request parking slots; owners approve/reject; managers administer. Data is persisted in SQLite via SQLAlchemy. Authentication uses JWT (bcrypt password hashing, python-jose tokens). Multi-language support (EN/FR/HE) with RTL layout for Hebrew.

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
| `sarah@parking.dev` | Owner |
| `mike@parking.dev` | Owner |
| `admin@parking.dev` | Manager |
All users follow `<firstname>@parking.dev` pattern. See `seed.py` for the full list.

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

### 1 — Backend (Port 8000)
```bash
cd backend
python -m pip install -r requirements.txt
python seed.py        # first time only — creates/resets parking.db

# To allow access from other devices (mobile) on the same network:
python -m uvicorn main:app --host 0.0.0.0 --reload
```

### 2 — Frontend (Port 3000)
```bash
# In a separate terminal
npm install
npm start
```

## Local setup
- Full cross-platform and WSL instructions: `docs/LOCAL_SETUP.md` (phone access: `docs/MOBILE_ACCESS.md`).

## Mobile Access & CORS
- **Binding**: Running with `--host 0.0.0.0` makes the backend available on your machine's local IP (e.g., `192.168.x.x`).
- **CORS**: Allowed origins come from the `CORS_ORIGINS` env var (comma-separated); default is `http://localhost:3000`. Add your phone-facing origin, e.g. `http://192.168.x.x:3000`, when testing from another device.
- **Client Configuration**: Ensure `src/api/client.ts` uses the correct local IP if testing from a physical mobile device.

## Deployment (Azure demo)
- See `docs/AZURE_DEPLOY.md`: Static Web Apps (frontend) + App Service B1 (backend, SQLite in `/home/data`).
- Backend env: `SECRET_KEY`, `DATABASE_URL`, `AUTO_SEED_DEMO=true` (seeds an empty DB on start), `DEBUG=false`, `CORS_ORIGINS`, `LOG_DIR`.
- `.github/workflows/deploy-azure.yml` is gated by the repo variable `AZURE_DEPLOY=true`.

## Shutdown
- **Script**: `bash stop.sh` — finds and kills processes on ports 8000 + 3000 (works on Windows Git Bash, macOS, Linux)
- **Graceful**: Press `Ctrl+C` in the respective terminal windows.
- **Force (Windows)**:
  - Stop Backend: `taskkill /F /IM python.exe`
  - Stop Frontend: `taskkill /F /IM node.exe`

## Logging
- **Directory**: `logs/` at the project root (created automatically on startup if missing).
- **Files**:
  - `logs/parking.log`: Centralised backend application logs (API startup, requests, errors, scheduler actions).
- **Git**: The entire `logs/` directory is ignored by Git to keep the repository clean.
- **Testing**: `backend/tests/test_infra_hardening.py` verifies that the logging system is active and writing to the correct path.

## Running Tests

### Backend
```bash
cd backend
python -m pip install -r requirements-test.txt   # first time only
pytest tests/ -v
pytest tests/ --cov=. --cov-report=term-missing  # with coverage
```

### Frontend
```bash
# Run all tests in CI mode (desktop viewport)
$env:CI='true'; npm test -- --ci --no-cache
```

## Test Coverage Summary

### Frontend Tests
- `src/App.test.tsx` — Basic app rendering, navigation, and provider initialization.
- `src/RBAC.test.tsx` — **Critical**: Role-Based Access Control, session isolation, and logout URL state cleanup (verified by title-based lookups).
- `src/components/__tests__/AdminPanel.test.tsx` — Admin functionalities: User/Lot management and defensive UI rendering.
- `src/components/__tests__/AllPendingRequests.test.tsx` — Real-world simulation of approval/rejection workflows across roles.
- `src/components/__tests__/AdminPanelCharades.test.tsx` — Specialized logic for user preference synchronization and Edge-cases.
- `src/components/__tests__/MyRequests.test.tsx` — 15 tests: visibility filters, edit/cancel button logic, stats, navigation, info banner.

### Backend Tests
- 147 tests, always green. Uses in-memory SQLite (StaticPool) for testing — never touches `parking.db` in production.
- `conftest.py` — Fixtures: in-memory DB, TestClient with overrides, headers, and pwd hashing patches.
- `test_auth.py` — 9 tests: register, login, `/auth/me`.
- `test_requests.py` — 41 tests: Full CRUD, approve/reject, RBAC, and status guards.
- `test_lots.py` — 23 tests: Full CRUD, owner-scoping, and specialized role updates.
- `test_users.py` — 30 tests: Role restrictions, password changes, and self-delete prevention.
- `test_messages.py` — 16 tests: Communication RBAC and audit retention after request deletion.

## Key Files

### Internationalisation (i18n)
- `src/i18n/index.ts` — i18next init; `SupportedLanguage` type (`'en' | 'fr' | 'he'`); `SUPPORTED_LANGUAGES` array (with `nativeLabel`); `isRTL(lang)` helper; `getStoredLanguage()` / `storeLanguage()` helpers
- `src/i18n/en.json` — English translations (12 namespaces: nav, common, login, myRequests, pendingRequests, approvals, requestForm, requestDetail, notificationWindows, adminPanel, calendarView, lotCalendarView)
- `src/i18n/fr.json` — French translations (same 12 namespaces)
- `src/i18n/he.json` — Hebrew translations (same 12 namespaces; RTL)
- Language is persisted in `localStorage` (`parking_language`) and synced to/from the DB (`UserPreferences.language`)
- `App.tsx` — `ConfigProvider direction="rtl"` when Hebrew; `useLayoutEffect` syncs `<html dir>` and `<html lang>`; language dropdown in header (globe icon); `dayjs.locale()` activated on language change
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
  - `RequestMessage.request_id`: nullable, `ondelete="SET NULL"` — messages are preserved for 7-day audit retention after a request is deleted; FK is nulled explicitly in `delete_request()` because cascading delete is not suitable for an audit trail
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
- `backend/tests/conftest.py` — fixtures: in-memory SQLite (StaticPool), TestClient with `get_db` override, `user_headers` / `owner_headers` / `manager_headers`, `created_request_id`, `created_lot_id`
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

### Reusable Components
- `src/components/EmptyState.tsx` — empty state with icon, title, description, optional CTA button

### Styles
- `src/components/CalendarView.css` — shared by CalendarView and LotCalendarView
- `src/components/LotCalendarView.css` — lot calendar specific
- `src/components/AllApprovals.css` — `.owner-approval-row` highlight, mobile card list + stats chips
- `src/components/AllPendingRequests.css` — mobile card list + stats chips, rejected card styling
- `src/components/MyRequests.css` — mobile card list styles
- `src/components/MyLots.css` — mobile card list styles
- `src/components/LotStatusBoard.css` — parking grid, dark mode fixes, mobile compact grid
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
- `MyRequests`, `AllPendingRequests`, `AllApprovals`, `MyLots` use card list on mobile
- `LotStatusBoard` uses compact grid on mobile (smaller spots, full-width modal)
- Calendars default to `day` view on mobile, `week` on desktop

### Empty States
- Reusable `<EmptyState />` component (`src/components/EmptyState.tsx`) with icon, title, description, optional CTA button
- Wired into: `MyRequests`, `AllPendingRequests`, `AllApprovals`, `MyLots`, `LotStatusBoard`, `RequestDetail` (messages)
- Desktop tables use `locale={{ emptyText: <EmptyState /> }}`; mobile card views render inline

### Table Sorting & Search
- **Sortable columns** via Ant Design `sorter` prop on key columns (date, requester, submitted, duration, lot owner, status)
- `AllPendingRequests`: search input filters by requester name; sortable date, submitted, requester columns
- `AllApprovals`: search input filters by requester or lot owner; "My lot only" toggle; sortable date, requester, lotOwner, approvedAt, duration
- `MyRequests`: sortable Date, Duration, Submitted columns
- `MyLots`: sortable Lot ID, Floor, Status columns

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
1. Improve overlapping events display — hover tooltip for narrow calendar events (Phase 2 item #5)
2. Remove restriction on time of day for requests — allow any time of day and max duration of 36 hours (multi-day support)
3. Keyboard accessibility — full-app pass: `role="button"` + `tabIndex` + `onKeyDown` (Enter/Space) on all clickable non-button elements (parking spots, card rows, status tags); audit and fix tab order across all 11 screens; `aria-label` on all icon-only controls (language toggle, dark mode button, calendar nav arrows); verify focus trapping and focus restoration in all modals; add skip-to-content link
4. Color & contrast audit — run a WCAG AA check (4.5:1 normal text, 3:1 large text / UI components) against all status tag colors (`statusUtils.ts`: `getStatusColor`, `getLotStatusTagColor`, `getRequestStatusColor`), info banner backgrounds (`--info-card-bg`), and all text/background combinations in both light and dark mode; fix any failures
5. Rejection reason — add `rejection_reason` (nullable text) to `ParkingRequest`; make it an optional field on `PATCH /api/requests/{id}/reject`; surface it in `RequestDetail`, `MyRequests` (mobile card), and `AllApprovals`; include it in the `AuditLog` details on rejection
6. Soft-delete cancelled requests — add `cancelled` to `RequestStatus` enum and `deleted_at` (nullable ISO string) to `ParkingRequest`; change `DELETE /api/requests/{id}` to set `status='cancelled'` + `deleted_at=now()` instead of removing the row; filter cancelled records out of all active views (`/pending`, `/approved`, calendar, status board) but keep them visible in `MyRequests` history and the Admin Panel; update all backend tests that currently assert a 404 after cancellation
7. Typed notifications — add `notification_type` column to `Notification` (enum: `request_submitted` | `request_approved` | `request_rejected` | `request_cancelled` | `auto_assigned` | `new_message`); add `linked_request_id` (nullable, references `parking_requests.id`); update all notification-creation callsites to always set the type and link; update the frontend notification UI to render type-specific icons and navigate to the linked request on click
8. Availability warning on request form — when date + start time + duration are all filled in `ParkingRequestForm`, query the backend to check whether any lots have open availability windows covering that window and no conflicting approved bookings; show a non-blocking inline `Alert` warning if no lots are available so the user knows approval is unlikely before submitting
9. Filter persistence — persist search text, sort column, and sort direction for `AllPendingRequests`, `AllApprovals`, `MyRequests`, and `MyLots` in `localStorage` (keyed per screen, e.g. `parking_filter_pending`); restore on component mount so state survives page refresh and navigation
10. Admin global search — add a search bar to the Admin Panel; search users by name (filtered client-side from the already-loaded users list); search requests by date range (date picker) and optionally by requester name (text input); display results in two grouped sections (Users / Requests) within the existing Admin Panel layout

### Completed
- ~~Empty state UI for all tables~~ ✅ Done (Phase 1)
- ~~Audit trail — `created_at` / `updated_at` timestamps on records~~ ✅ Done (PR #61: "Last Updated" sub-line in MyRequests, "Submitted" column in AdminPanel)
- ~~RTL layout for react-big-calendar — library has no RTL support; calendar stays LTR even in Hebrew mode~~ ✅ Done (PR #60: wrapped calendar in `dir="ltr"`, added Hebrew-only info note)
- ~~Hide old requests from table views — except for admin screens, show only requests starting from 'yesterday' forward~~ ✅ Done
- ~~Invert availability logic — lots should be 'Blocked by Default'. Owners must define explicit availability windows/time slots for sharing~~ ✅ Done
- ~~Implement 'Availability Windows' UI — for owners to define when their lots are open for requests~~ ✅ Done
- ~~Component extraction — `<StatsBar />`, `<InfoBanner />` reusable components~~ ✅ Done (`<PageWrapper />` was never created; see the refactor plan)
- ~~Loading skeleton states — replace `<Spin>` with `<Skeleton>` matching layout shapes~~ ✅ Done (Phase 4 item #11)
- ~~AdminPanel mobile card views — Users, Lots, Requests tables lack mobile card fallback~~ ✅ Done
