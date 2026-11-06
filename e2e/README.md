# E2E Tests (Playwright)

## Prerequisites

Both servers must be running before executing tests.

```bash
# Terminal 1 — backend (seed DB first time only)
cd backend
python seed.py        # reset DB to clean seed state before each full run
python -m uvicorn main:app --host 0.0.0.0 --reload

# Terminal 2 — frontend
npm start
```

Or use the convenience script:
```bash
bash start.sh
```

## Run

```bash
# Headless (CI)
npm run test:e2e

# Headed (watch browser)
npm run test:e2e:headed

# Interactive UI mode
npm run test:e2e:ui
```

## Structure

```
e2e/
  fixtures/
    auth.ts          ← role-based API login (loginAs), UI login helper, waitForNav
    api.ts           ← backend helpers: throwaway accounts, create/approve requests, cleanup
    ui.ts            ← Ant Design helpers: table rows, confirm dialogs, Select picking, toasts
    global-setup.ts  ← verifies both servers are reachable; registers the e2e-user account
  tests/
    auth.spec.ts                 ← login/logout via UI, error handling, session guard
    role-navigation.spec.ts      ← nav items visible per role; direct URL access
    submit-request.spec.ts       ← request form: validation, end-time calc, multi-day, limit, submit
    my-requests.spec.ts          ← requester view: list, edit, cancel, approved state
    approve-request.spec.ts      ← owner approve / reject / re-approve, search, Approvals list
    request-detail.spec.ts       ← request detail page and the requester ↔ owner message thread
    notifications.spec.ts        ← bell badge, mark one / all read, manager broadcast
    lot-status.spec.ts           ← Parking Status board, lot dialog, keyboard, occupancy over time
    availability-windows.spec.ts ← owner availability windows: add, validate, toggle, delete
    my-lots.spec.ts              ← owner lots view
    admin-panel.spec.ts          ← manager admin panel sections and content
    admin-actions.spec.ts        ← role change, delete user, broadcast, blackout, reports counts
    calendars.spec.ts            ← Requests View + Lot Calendar views and events
    preferences.spec.ts          ← dark mode + language (EN/FR/HE, RTL), persisted per user
    accessibility.spec.ts        ← axe-core scan of every screen (see below)
```

## Writing tests

- **Create data through the API, assert through the UI.** `fixtures/api.ts` gives each test its own
  throwaway account (`createAccount`) with a unique, searchable name, plus `createPendingRequest`.
  Tables then contain exactly the rows the test made — no pagination, no reliance on seed data, no
  skipped tests when the DB is empty. Clean up in `afterEach` with `deleteAccount` (it cancels the
  account's requests first).
- **Use unique future dates** for anything that assigns a lot: two approved requests cannot share a lot
  and time slot, so tests that approve with `lot_id` pick their own date.
- **Table rows are `tr.ant-table-row`**, not `.ant-table-tbody tr`: the latter also matches antd's hidden
  `ant-table-measure-row`, which is never visible.
- **Select options are virtualized** — use `pickOption()` from `fixtures/ui.ts`, which scrolls to the
  option, rather than clicking `getByRole('option')`.
- **Icon-only buttons are located by `title`** (e.g. `button[title="Cancel"]`): their accessible name
  currently comes from the icon (`delete`, `edit`) rather than the title.

## Accessibility scan (axe)

`e2e/tests/accessibility.spec.ts` runs axe-core (WCAG 2.0/2.1 A + AA) over every screen each
role can reach, in light mode, dark mode and Hebrew (RTL).

```bash
npx playwright test accessibility                 # must pass; new violations fail it
A11Y_CONTRAST=1 npx playwright test accessibility # also report colour-contrast (known issues, TODO #4)
```

Theme/language are per-user preferences, so the spec sets them through the API before logging in.
Seeded demo accounts: `sarah@parking.dev` (owner), `admin@parking.dev` (manager); the `e2e-user`
account is registered by global setup.
