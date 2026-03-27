# CLAUDE.md — Parking Mockup Project

## Project Overview
A React mockup of a parking management system. Users can request parking slots; owners approve/reject requests and manage their lots. No backend — all data is in-memory via React Context.

## Tech Stack
- **React 19** + **TypeScript** + **Create React App**
- **Ant Design (antd v6)** — UI components
- **react-big-calendar** with `dayjsLocalizer` — calendar views (day/week/month)
- **withDragAndDrop** from react-big-calendar addons — drag to reschedule
- **react-router-dom** — routing
- **dayjs** — date formatting

## Current User / Role
The logged-in user is always **Sarah Johnson** (`owner-001`), role: **Owner**.
- `CURRENT_OWNER_NAME = 'Sarah Johnson'`
- `CURRENT_OWNER_ID = 'owner-001'`
Both constants are exported from `src/contexts/RequestsContext.tsx`.

## Roles
- **User** — can submit and manage own requests
- **Owner** — can approve/reject requests, view Lot Calendar, manage My Lots
- **Manager** — has access to Admin Panel

Role is selected from a dropdown in the app header (simulated auth).

## Key Files

### State / Data
- `src/contexts/RequestsContext.tsx` — single source of truth for all request state
  - `pendingRequests` (REQ-010 to REQ-019)
  - `approvedRequests` (REQ-001 to REQ-009, REQ-020)
  - `userRequests` — Sarah Johnson's own requests (REQ-013, REQ-016, REQ-017)
  - `approveRequest(id, lotInfo?)` — moves pending → approved, accepts optional lot assignment
  - `rejectRequest(id)` — sets `status: 'rejected'`
  - `cancelUserRequest(id)` — removes from userRequests
  - `updateUserRequest(id, updates)` — edits date/time of a pending request

### Mock Data
- `src/mock/lotsData.ts` — floor/lot structure, owner assignments, blocked dates
- `src/mock/approvalsData.ts` — static snapshot matching `initialApprovedRequests` (used only where context is not available)

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
| `ParkingRequestForm.tsx` | `/submit-request` | (accessed via "+ New Request" button) |

### Styles
- `src/components/CalendarView.css` — shared by both CalendarView and LotCalendarView
- `src/components/LotCalendarView.css` — lot calendar specific
- `src/components/AllApprovals.css` — includes `.owner-approval-row` highlight
- `src/components/MyRequests.css` — includes mobile card list styles
- `src/index.css` — global CSS variables (dark/light theme)

## Conventions

### Info Banners
Every screen has an info banner **at the bottom** (below stats) describing the screen's purpose.
- Use `<Card size="small" style={{ marginTop: '24px', backgroundColor: 'var(--info-card-bg)' }}>`
- Format: `<strong>Screen Name:</strong> One sentence describing the purpose.`
- `LotStatusBoard` uses `<Alert>` instead of Card (Ant Design Alert component).

### Stats / Totals
Summary stat cards appear **at the bottom**, above the info banner.

### Pagination
Always use `pagination={{ pageSize: 10, hideOnSinglePage: true }}` on all Tables.

### Mobile Responsiveness
- Use `window.matchMedia('(max-width: 768px)')` with a `useEffect` listener for reactive mobile detection.
- `MyRequests` uses a card list layout on mobile instead of a Table.
- Calendars use `day` view by default on mobile, `week` on desktop.

### Calendar Settings
Both `CalendarView` and `LotCalendarView` use:
- `step={60}` + `timeslots={1}` — 1-hour time slots (no half-hour lines)
- `min` = 07:00, `max` = 20:00
- `scrollToTime` = 08:00
- `slotPropGetter` highlights the current hour block in blue (`rgba(22, 119, 255, 0.18)`)
- `.rbc-current-time-indicator { display: none }` — thin line hidden (block highlight used instead)

### Row Highlighting
`AllApprovals` highlights rows where `lotOwner === CURRENT_OWNER_NAME` using `.owner-approval-row` CSS class (`rgba(22, 119, 255, 0.08)` background).

## Mock Data IDs
| Range | Type |
|-------|------|
| REQ-001 – REQ-009 | Approved requests |
| REQ-010 – REQ-019 | Pending requests |
| REQ-020 | Approved (today, for testing) |
| REQ-016, REQ-017 | Sarah Johnson's own history (approved, rejected) |

## Lot IDs (lotsData)
Lots are grouped by floor: `F1-001`–`F1-006`, `F2-001`–`F2-005`, `F3-001`–`F3-005`.
Sarah Johnson owns: **F1-001, F1-002, F1-006** (Floor 1 - Ground Floor).

## Git / Branching
- Main branch: `master`
- Feature branch: `claude/relaxed-nash`
- PR: https://github.com/regevha/parking-mockup/compare/master...claude/relaxed-nash

## Pending TODOs
1. Improve overlapping events display — hover tooltip for narrow calendar events
2. Fix MyLots screen — align mock data to Sarah Johnson (currently shows Jane Smith)
3. Add info banner to AdminPanel screen
4. Review ParkingRequestForm — info banner, layout, field consistency
5. Merge PR and update master branch
