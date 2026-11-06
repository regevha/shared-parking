import { Page } from '@playwright/test';

/**
 * Direct backend helpers for e2e tests.
 *
 * Most UI flows need *data* in a known state (a pending request, an approved request, a notification).
 * Creating it through the API is faster and far less flaky than clicking through the UI, and giving
 * each test its own throwaway account means:
 *   - the account's tables contain exactly the rows the test created (no pagination, no clutter),
 *   - the `e2e-user` fixture account never hits the pending-request limit,
 *   - tests don't depend on how much seed data is left over from a previous run.
 */

export const API = 'http://localhost:8000';
export const E2E_PASSWORD = 'E2eUser123';

export interface Account {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

const rand = () => Math.random().toString(36).slice(2, 8);

async function formLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Token for a seeded demo account (owner: sarah, manager: admin). */
export const ownerToken = () => formLogin('sarah@parking.dev', 'password123');
export const managerToken = () => formLogin('admin@parking.dev', 'password123');

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

export async function api<T = any>(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body (e.g. 204) */
  }
  return { status: res.status, body };
}

/** Register a brand-new user-role account with a unique, searchable display name. */
export async function createAccount(label = 'flow'): Promise<Account> {
  const suffix = rand();
  const name = `E2E ${label} ${suffix}`;
  const email = `e2e-${label}-${suffix}@parking.dev`;
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: E2E_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Could not register ${email}: ${res.status} ${await res.text()}`);
  const { id } = await res.json();
  return { id, name, email, password: E2E_PASSWORD, token: await formLogin(email, E2E_PASSWORD) };
}

/** Best-effort cleanup: cancel the account's requests, then delete the account (manager only). */
export async function deleteAccount(acc: Account | undefined): Promise<void> {
  if (!acc) return;
  try {
    const mine = await api<any[]>(acc.token, 'GET', '/api/requests/me');
    if (Array.isArray(mine.body)) {
      for (const r of mine.body) await api(acc.token, 'DELETE', `/api/requests/${r.id}`);
    }
    const mgr = await managerToken();
    await api(mgr, 'DELETE', `/api/users/${acc.id}`);
  } catch {
    /* cleanup must never fail a test */
  }
}

/** A weekday-agnostic date `daysAhead` from today, as YYYY-MM-DD (local time, matching the UI). */
export function futureDate(daysAhead = 40): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** YYYY-MM-DD → DD/MM/YYYY, the format every table in the UI uses. */
export const uiDate = (iso: string) => iso.split('-').reverse().join('/');

export interface NewRequest {
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

export async function createPendingRequest(token: string, opts: NewRequest = {}): Promise<{ id: string; date: string }> {
  const date = opts.date ?? futureDate();
  const res = await api(token, 'POST', '/api/requests', {
    date,
    start_time: opts.startTime ?? '09:00',
    end_date: date,
    end_time: opts.endTime ?? '10:00',
    duration: opts.duration ?? 1,
  });
  if (res.status !== 201) throw new Error(`Could not create request: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.id, date };
}

/**
 * Put the shared demo accounts back to the app defaults (dark mode, English).
 *
 * Theme and language are stored per user in the DB, so a spec that switches them for a shared account
 * (the a11y scan does) would otherwise leave every later spec running in Hebrew / light mode.
 */
export async function resetSharedAccountPreferences(): Promise<void> {
  const accounts = [
    ['sarah@parking.dev', 'password123'],
    ['mike@parking.dev', 'password123'],
    ['admin@parking.dev', 'password123'],
    ['e2e-user@parking.dev', E2E_PASSWORD],
  ];
  for (const [email, password] of accounts) {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      });
      if (!res.ok) continue; // account not present (e.g. e2e-user before registration)
      const { access_token, user_id } = await res.json();
      await api(access_token, 'PATCH', `/api/users/${user_id}/preferences`, { dark_mode: true, language: 'en' });
    } catch {
      /* best effort */
    }
  }
}

/** Set the browser's session to an already-authenticated account (no login form involved). */
export async function loginWithToken(page: Page, token: string): Promise<void> {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('parking_token', t), token);
}
