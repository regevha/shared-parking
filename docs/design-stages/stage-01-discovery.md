# Stage 1 — Discovery Report

Read-only inventory of the shared-parking codebase. Raw findings — no prose yet.

## Backend Inventory
- **Framework**: FastAPI + SQLAlchemy + SQLite, APScheduler background job.
- **8 routers**: `auth`, `requests`, `lots`, `messages`, `users`, `config`, `notifications`, `admin`.
- **8 models**: `User`, `UserPreferences`, `ParkingRequest`, `RequestMessage`, `Lot`, `AuditLog`, `Notification` + enums (`UserRole`, `RequestStatus`, `LotStatus`).
- **Auth**: JWT (HS256), bcrypt direct, 480-min (8 h) token, OAuth2 form login; guards `get_current_user`, `require_owner`, `require_manager`.
- **Scheduler**: `run_auto_approval` runs every 15 min (configurable); oldest-first pending; tries assigned lot then any available; checks conflicts + owner availability windows.
- **Startup migrations**: idempotent ALTER TABLEs for legacy DBs.
- **Dev-only internal endpoints**: pause/resume scheduler for Playwright tests.

## Domain Logic Discovered
- **Roles**: `user`, `owner`, `manager` — privilege ladder (manager inherits owner in `require_owner`).
- **Request statuses**: `pending` → `approved` | `rejected` (terminal).
- **Lot statuses**: `available`, `blocked`, `unowned`, `unowned-blocked`.
- **Requests**: multi-day via `end_date`/`end_time`; duration 1–36 h (configurable).

### Business Rules Found
1. Max **5 pending requests** per user (configurable `MAX_PENDING_REQUESTS`).
2. **Cancellation window**: approved requests cannot be cancelled within 2 h of start (managers exempt; configurable).
3. Auto-approval respects owner **availability windows** (JSON per weekday).
4. Conflict detection: time-range overlap on same lot against approved.
5. Approve requires `pending`; update restricted to owner + pending; delete restricted to owner (with cancellation window guard).
6. Manager cannot delete own account.
7. Manager-only role changes; self can change name/email/password.
8. Email uniqueness enforced on update.
9. `approved_by` = `"auto"` for scheduler, owner name for manual.
10. Audit actions: `submitted | approved | rejected | cancelled | auto-assigned | updated`.
11. Messages retained after request deletion (`request_id = NULL`).
12. Notifications: last 50 surfaced; broadcast by manager to `users | owners | both`.
13. Date cannot be in the past; HH:MM / YYYY-MM-DD regex enforced.
14. Message text: non-empty, ≤ 1000 chars.
15. Language allowlist: `en | fr | he`.
- Audit-trail view access: manager, requester, involved lot owner, or any owner while pending.
- CSV bulk import: users + lots (manager only).
- System config endpoint exposes timezone, blackout window, max pending (read-only).

## Frontend Inventory
- **React 19 + TS + CRA**, Ant Design v6, react-router, react-big-calendar, dayjs, i18next.
- **App shell**: role-derived menu, dark-mode toggle (DB-persisted), language selector, notification bell, settings dropdown, mobile drawer.
- **11 screens**: LotStatusBoard, AllPendingRequests, AllApprovals, MyRequests, ParkingRequestForm, RequestDetail, MyLots, LotCalendarView, CalendarView, AdminPanel, AvailabilityWindows, NotificationWindows.
- **Contexts**: `AuthContext` (token in localStorage, re-validated on mount via `/auth/me`); `RequestsContext` (pending/approved/mine/lots; owner-scoped lots for owners).
- **API layer**: 9 modules, snake_case ↔ camelCase mapping, auto Bearer attachment.
- **i18n**: 3 languages; preference persisted in both localStorage and DB.

## Entities Beyond CLAUDE.md
- `AuditLog` table (full request history).
- `Notification` table + broadcast feature.
- `AvailabilityWindows` (per-owner, per-weekday JSON; enforced by scheduler).
- CSV bulk-import admin endpoints.

## Resolved Open Points
1. AvailabilityWindows — **first-class domain concept**.
2. Broadcast notifications — **documented in admin/tech section**.
3. CSV import — **documented in admin/tech section**.
4. Blackout window — **configured-but-unenforced constant** (documented as such).
