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
    auth.ts          ← API login helper + UI login helper + waitForNav
    global-setup.ts  ← verifies both servers are reachable before suite starts
  tests/
    auth.spec.ts           ← login/logout via UI, error handling, session guard
    role-navigation.spec.ts ← nav items visible per role; direct URL access
    submit-request.spec.ts  ← user submits a new parking request
    approve-request.spec.ts ← owner approves/rejects pending requests
    admin-panel.spec.ts     ← manager admin panel tabs and content
    my-lots.spec.ts         ← owner lots view
```

## Notes

- **Serial execution** (`workers: 1`): tests share one SQLite DB; parallel writes would corrupt state.
- **Re-seed before each run**: `python seed.py` in the `backend/` directory restores clean data.
- Tests that depend on pending requests in the DB will skip gracefully if the DB is empty (e.g. after all requests have been approved in a previous run).
- The `loginAs()` helper injects a JWT directly into `localStorage`, bypassing the login form — ~10x faster than UI login for tests that don't test auth itself.

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
