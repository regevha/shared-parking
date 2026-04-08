# Frontend Enhancements + Seed Data Overhaul

## Context
Phases 1-4 of UX improvements are complete (PRs #35-#38). This plan tackles the remaining CLAUDE.md TODOs, accessibility, dark mode CSS fixes, i18n gaps, and seed data improvements. The user specifically requested: (1) frontend enhancements, (2) improved seed data, (3) increase to 10 parking lots.

---

## Phase 1: Seed Data Overhaul
**Branch:** `feature/seed-data-v2`

### Changes

**`backend/seed.py`**
- Add 2 "user" role accounts (Tom/U1, Amy/U2) — currently no basic users in seed
- Expand lots from 6 to 10 with balanced ownership and status variety:
  - Sarah: 3 lots (was 4), Mike: 3 lots (was 1), Lisa: 2 lots (was 1), 2 unowned
  - Statuses: 6 available, 2 blocked, 1 unowned, 1 unowned-blocked (was all available)
  - 3 floors: F1 (4 lots), F2 (3 lots), F3 (2 lots) — was only F1+F2
- Add requests from user-role accounts (Tom, Amy as requesters)
- Distribute approved requests across new lots

**`src/components/LoginPage.tsx`** — add Tom (user role) to demo account tags

**`CLAUDE.md`** — update demo accounts table

### Verify
- `python seed.py` → 7 users, 10 lots, ~35 requests
- `pytest tests/ -v` → 147 pass
- Frontend: LotStatusBoard shows all 4 statuses, AdminPanel lots shows all filters populated

---

## Phase 2: Accessibility, Dark Mode, i18n Fixes
**Branch:** `feature/a11y-darkmode-i18n`

### A. LotStatusBoard Accessibility (HIGH)
**`src/components/LotStatusBoard.tsx:103-112`**
- Add `role="button"`, `tabIndex={0}`, `aria-label`, `onKeyDown` (Enter/Space) to parking spot divs

### B. Calendar Toolbar aria-labels (MEDIUM)
**`src/components/CalendarView.tsx`** + **`LotCalendarView.tsx`** — add `aria-label` to Prev/Next/Today buttons

### C. Dark Mode CSS Fixes (MEDIUM)
**`src/index.css`** — add new CSS variables (`--toolbar-btn-border`, `--toolbar-btn-bg`, `--text-secondary`, `--notification-unread-bg`, `--notification-hover-bg`, etc.)

Replace hardcoded hex colors with CSS vars in:
- `CalendarView.css` — `#d9d9d9`, `#fff`, `#bbb`
- `AllPendingRequests.css` — `#666`
- `NotificationBell.css` — `#e6f7ff`, `#fafafa`, `#262626`, `#8c8c8c`
- `RequestDetail.css` — `#1890ff`, `#999`
- `AuditTrailModal.css` — extensive hardcoded colors
- `AvailabilityWindows.css` + `NotificationWindows.css` — `#999`

### D. i18n Fixes (MEDIUM)
- Replace hardcoded "Auto" in `AllApprovals.tsx:118`, `MyRequests.tsx:206`, `RequestDetail.tsx:102` with `t('common.autoApproved')`
- Wrap missing `t()` in `RequestDetail.tsx:99`
- Add keys to en/fr/he.json

### E. Performance Quick Fixes (LOW)
- `AllApprovals.tsx:149` — wrap `stats` in `useMemo`
- `CalendarView.tsx` + `LotCalendarView.tsx` — move constant time values to module scope

### Verify
- `CI=true npm test -- --ci --no-cache` → 119 pass
- Toggle dark mode, visit every screen — no white-on-white or invisible text
- Tab through LotStatusBoard parking spots, Enter opens modal
- Check "Auto" tags in all 3 languages

---

## Phase 3: Skeleton Loading, AdminPanel Mobile Cards
**Branch:** `feature/skeleton-mobile-extraction`

### A. StatsBar Component Extraction
**New: `src/components/StatsBar.tsx`**
- Props: `items: Array<{ label: string; value: number; color?: string }>`
- Refactor stats sections in: MyRequests, AllApprovals, AllPendingRequests, CalendarView, LotCalendarView, LotStatusBoard

### B. Loading Skeleton States (CLAUDE.md TODO #11)
Replace `<Spin>` with `<Skeleton>` matching layout shapes in:
- `AdminPanel.tsx` — content area + config section
- `LotStatusBoard.tsx` — grid of square skeletons
- `NotificationWindows.tsx` + `AvailabilityWindows.tsx` — card skeletons
- `RequestDetail.tsx` — message-shaped skeletons

### C. AdminPanel Mobile Card Views (CLAUDE.md TODO #12)
**`src/components/AdminPanel.tsx`** — add mobile card fallbacks for Users, Lots, Reports tables
**`src/components/AdminPanel.css`** — add mobile card CSS classes
**i18n files** — add `adminPanel.mobile.*` labels

### Verify
- Resize to 375px, verify AdminPanel Users/Lots/Reports show card views
- Network throttle → verify skeletons appear (not spinners)
- Verify StatsBar renders identically on all 6 screens
- All tests pass
