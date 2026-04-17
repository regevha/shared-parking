import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * IMPORTANT: These tests assume the dev servers are already running:
 *   - Frontend:  npm start  (port 3000)
 *   - Backend:   uvicorn main:app --reload  (port 8000)
 *
 * We intentionally do NOT auto-start servers here because:
 *   1. The backend requires an active parking.db (seeded with `python seed.py`)
 *   2. Starting/stopping both processes reliably across platforms is complex
 *   3. Developers typically have servers running during development anyway
 *
 * Start servers manually before running: npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
