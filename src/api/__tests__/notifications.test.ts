import { notificationsApi } from '../notifications';
import { ApiError } from '../client';

// ── fetch mock setup ─────────────────────────────────────────────────────────

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch;
});
beforeEach(() => {
  mockFetch.mockReset();
  localStorage.setItem('parking_token', 'test-token');
});

function mockOk(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => body,
  });
}

function mockError(status: number, detail = 'Error') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ detail }),
  });
}

// ── getNotifications ──────────────────────────────────────────────────────────

describe('notificationsApi.getNotifications', () => {
  it('sends GET to /api/notifications', async () => {
    mockOk([]);
    await notificationsApi.getNotifications();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/notifications');
  });

  it('attaches Authorization header', async () => {
    mockOk([]);
    await notificationsApi.getNotifications();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer test-token');
  });
});

// ── markAsRead ────────────────────────────────────────────────────────────────

describe('notificationsApi.markAsRead', () => {
  it('sends PATCH to /api/notifications/:id/read', async () => {
    mockOk({ id: 5, is_read: true });
    await notificationsApi.markAsRead(5);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/notifications/5/read');
    expect(options.method).toBe('PATCH');
  });
});

// ── markAllRead ───────────────────────────────────────────────────────────────

describe('notificationsApi.markAllRead', () => {
  it('sends POST to /api/notifications/read-all', async () => {
    mockOk({ status: 'ok' });
    await notificationsApi.markAllRead();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/notifications/read-all');
    expect(options.method).toBe('POST');
  });
});

// ── broadcast ────────────────────────────────────────────────────────────────

describe('notificationsApi.broadcast', () => {
  it('sends POST to /api/notifications/broadcast with audience and message', async () => {
    mockOk({ status: 'ok', delivered_to: 3 });
    await notificationsApi.broadcast('users', 'System maintenance tonight');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/notifications/broadcast');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.audience).toBe('users');
    expect(body.message).toBe('System maintenance tonight');
  });
});

// ── Error propagation ─────────────────────────────────────────────────────────

describe('notificationsApi — error handling', () => {
  it('throws ApiError on non-ok response', async () => {
    mockError(401, 'Unauthorized');
    await expect(notificationsApi.getNotifications()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    });
  });
});
