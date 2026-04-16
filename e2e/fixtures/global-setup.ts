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
  // test account on demand. The endpoint is idempotent — duplicate email
  // returns 400 which we silently ignore.
  const registerRes = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E User',
      email: 'e2e-user@parking.dev',
      password: 'password123',
      role: 'user',
    }),
  });

  if (!registerRes.ok && registerRes.status !== 400) {
    const body = await registerRes.text();
    throw new Error(`Failed to register E2E test user: ${registerRes.status} ${body}`);
  }
}
