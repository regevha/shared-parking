# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.13.0] - 2026-05-05

### Fixed
- Notification popover no longer overflows the screen on mobile portrait
- Hebrew translations missing in `RequestDetail` and `MyRequests` mobile card view
- Language (globe) button was hidden in mobile portrait header — restored

---

## [0.12.0] - 2026-04-29

### Added
- Audit timestamps surfaced in the frontend — "Last Updated" sub-line in `MyRequests`, "Submitted" column in Admin Panel

### Fixed
- `react-big-calendar` wrapped in `dir="ltr"` so the calendar remains readable in Hebrew/RTL mode

---

## [0.11.0] - 2026-04-26

### Added
- Lots are now **blocked by default** — owners must define explicit availability windows before a lot can accept bookings
- **Availability Windows UI** — owners configure per-lot recurring weekly slots and one-time date overrides
- Past requests hidden from all non-admin views (only requests from yesterday onwards are shown to users and owners)
- DB health test warns when `parking.db` is empty or not seeded

### Fixed
- 8 backend tests broken by availability-windows and password policy changes

---

## [0.10.0] - 2026-04-16

### Added
- Playwright E2E test suite covering approval, rejection, and cancellation flows
- `InfoBanner` and `PageWrapper` extracted as reusable components

### Security
- JWT expiry reduced to 1 hour (configurable via `JWT_EXPIRY_HOURS` env var)
- Message ownership enforced — users can only send messages on their own requests
- Password strength policy enforced on registration and password change
- Lot ownership verified before an approval can assign a lot
- HTTP security headers added (`X-Content-Type-Options`, `X-Frame-Options`, etc.)
- CORS restricted to explicit origins; wildcard removed from default config
- Swagger UI gated behind authentication in non-development environments
- FK constraints enforced in database migrations
- `follow-redirects` bumped to 1.16.0 (CVE fix)

---

## [0.9.0] - 2026-04-11

### Added
- Approved-by display on request rows (shows owner name or "Auto" for scheduler approvals)
- Pending request quota raised from 5 to 10; only future requests count toward the limit
- Ended requests hidden from `MyRequests` view to keep it focused on active bookings

### Fixed
- Status and "Auto" tags in `MyRequests` were displayed in English regardless of language — now translated
- Language preference was reset to default when navigating between screens — now preserved

---

## [0.8.0] - 2026-04-09

### Added
- Frontend test expansion: `AuthContext`, `RequestsContext`, `LoginPage`, and full API layer tests (55 new tests)
- Phase 4 frontend component tests (`MyRequests`, `AdminPanel`, `AllPendingRequests`)
- Backend CSV import endpoint with 14 tests
- Seed data expanded to 21 users, 17 lots, and 20 requests across all statuses and roles

---

## [0.7.0] - 2026-04-08

### Added
- **Phase 1 UX** — empty states on all tables and card views; dark mode colour fixes; i18n key renames
- **Phase 2 UX** — mobile card list views for `MyRequests`, `AllPendingRequests`, `AllApprovals`, `MyLots`; responsive parking grid
- **Phase 3 UX** — sortable columns on all tables; search inputs on `AllPendingRequests` and `AllApprovals`; "My lot only" toggle in Approvals
- **Phase 4 UX** — mobile polish across Admin Panel, calendars, modals, and header
- **Phase 5 UX** — `StatsBar` extracted as a reusable component; Skeleton loading states replace `Spin` spinners; Admin Panel mobile card fallback
- Available lot count per hour displayed in Lot Calendar slot filter
- "All Lots" system-wide view added to Lot Calendar
- Booking start/end times and request ID shown in occupied lot modal
- Occupancy-aware lot status board (live availability computed from approved requests)
- `stop.sh` cross-platform shutdown script for ports 8000 + 3000

---

## [0.6.0] - 2026-04-06

### Added
- **Audit trail** — lifecycle events written to `AuditLog` table on every status change (submitted, approved, rejected, cancelled, auto-assigned)
- **In-app notification system** — unread badge in header, notification list, backend API, and frontend UI
- RBAC session isolation — logout navigates explicitly to `/` to prevent URL leakage to the next user
- `BrowserRouter` moved to `index.tsx` to cover the full session lifecycle
- Mobile network access — backend binds to `0.0.0.0`; CORS allows all origins for local development

### Fixed
- Admin Panel route guard hardened; component-level permission check added as defense-in-depth
- Test suite stabilised (ID/label mismatches, syntax errors, ESLint issues)

---

## [0.5.0] - 2026-04-04

### Added
- **Auto-approval scheduler** (APScheduler) — runs every 15 minutes, approves conflict-free pending requests, and assigns an available lot automatically
- **Lot Calendar** — owner-scoped view of bookings across owned lots with day/week/month navigation
- **Lot Status Board** — visual parking grid with live occupancy; click a spot to see booking details and requester info
- Date ascending default sort on all request tables
- Max pending requests limit (configurable; default 10)

### Fixed
- Requests View calendar now includes all approved requests across all lots
- Dark mode stat bars were invisible due to hardcoded light colours — fixed

---

## [0.4.0] - 2026-03-30

### Added
- **Internationalisation (i18n)** — full English and French support across all 12 screens via react-i18next
- **Hebrew (HE) with RTL layout** — full translation and `ConfigProvider direction="rtl"` for right-to-left UI
- Language preference persisted in the database (`UserPreferences.language`) — follows the user across devices and sessions
- Notification Windows screen — owners configure per-day available time windows stored in user preferences
- Admin Panel wired to real backend API (user and lot CRUD, request management; mock data removed)
- Excel export in Admin Panel

### Changed
- Status tag colours centralised into `statusUtils.ts` (`getStatusColor`, `getLotStatusTagColor`, `getRequestStatusColor`)

---

## [0.3.0] - 2026-03-28

### Added
- **Request messages** — per-request comment thread between requester and owners/managers; messages retained for 7 days after request deletion (`request_id` set to NULL rather than cascade)
- Dark mode persisted in the database via `UserPreferences` table
- User dropdown menu in the header (name, role badge, logout)
- Frontend test suite — 100 tests across 7 suites
- Loading states on `AllApprovals`, `MyLots`, and `LotStatusBoard`
- Backend input validation and structured error responses

### Fixed
- Frontend form validation gaps (missing required-field checks)

### Changed
- Info banners standardised to bottom of every screen
- Pagination standardised to `pageSize: 10, hideOnSinglePage: true` on all tables

---

## [0.2.0] - 2026-03-27

### Added
- **Python/FastAPI backend** with SQLite via SQLAlchemy
- **JWT authentication** — login returns a signed token (HS256); all API requests require `Authorization: Bearer`
- bcrypt password hashing (passlib dropped; bcrypt called directly for compatibility with bcrypt ≥ 4.0)
- Role-based access control — three roles (`user` / `owner` / `manager`) enforced on every endpoint
- Full CRUD API for Users, Lots, and Parking Requests
- `PATCH /api/requests/{id}/approve` and `/reject` — owner-only endpoints
- `GET /api/users/{id}/preferences` + `PATCH` — per-user dark mode and notification settings
- pytest suite — 82 tests covering all API endpoints, RBAC, and error cases
- `created_at` / `updated_at` timestamps on all records

### Changed
- Lot filtering moved server-side; all mock JSON data files removed

---

## [0.1.0] - 2026-03-21

### Added
- Initial React 19 + TypeScript project (Create React App)
- Calendar views (day/week/month) via react-big-calendar with 1-hour slots, 07:00–20:00 range
- Lot Calendar View for owners with per-lot filtering
- Parking Status Board with visual lot grid
- Dark mode toggle with localStorage persistence
- Mobile responsive layout — card view for My Requests, 7-day compressed week grid
- Screens: My Requests, Requests View (calendar), Pending Requests, Approvals, Parking Status, Lot Calendar, My Lots, Admin Panel, Notification Windows, New Request Form, Request Detail
- Summary stats cards on all screens
- Info banners on all screens
