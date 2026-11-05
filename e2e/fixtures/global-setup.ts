import { FullConfig } from '@playwright/test';

const API = 'http://localhost:8000';

export default async function globalSetup(_config: FullConfig) {
  // ── 1. Verify both servers are reachable ─────────────────────────────────
  const check = async (url: string, label: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok && res.status !== 401 && res.status !== 422) {
        throw new Error(`${label} responded with ${res.status}`);
      }
    } catch (err: any) {
      if (err.message?.startsWith(label)) throw err;
      throw new Error(
        `${label} not reachable at ${url} — make sure both servers are running.\n` +
        `Run: bash start.sh  (or start backend + frontend separately)\n` +
        `Original error: ${err.message}`
      );
    }
  };

  await check(`${API}/auth/me`, 'Backend');
  await check('http://localhost:3000', 'Frontend');

  // ── 2. Ensure the E2E test user (user role) exists ───────────────────────
  // seed.py only seeds owner and manager accounts; we register a user-role
  // test account on demand. The endpoint is idempotent — 400 on duplicate ignored.
  const registerRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E User',
      email: 'e2e-user@parking.dev',
      password: 'E2eUser123',
    }),
  });

  if (!registerRes.ok && registerRes.status !== 400) {
    const body = await registerRes.text();
    throw new Error(`Failed to register E2E test user: ${registerRes.status} ${body}`);
  }

  // ── 3. Ensure pending requests exist for the approve-request tests ────────
  // Login as e2e-user and submit requests on future dates if none are pending.
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=e2e-user%40parking.dev&password=E2eUser123',
  });
  const { access_token } = await loginRes.json();

  // Check existing pending count
  const pendingRes = await fetch(`${API}/api/requests?status=pending`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const pending = await pendingRes.json();
  const pendingCount = Array.isArray(pending) ? pending.length : 0;

  if (pendingCount < 2) {
    // Submit a couple of future requests so approve/reject tests have data
    const today = new Date();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + 30 + i);
      const dateStr = d.toISOString().slice(0, 10);
      await fetch(`${API}/api/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          date: dateStr,
          start_time: '09:00',
          end_time: '10:00',
          duration: 1,
        }),
      });
    }
  }
}
