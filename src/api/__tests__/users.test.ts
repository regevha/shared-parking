import { usersApi } from '../users';

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

const rawUser = {
  id: 'u-1',
  name: 'Alice',
  email: 'alice@test.com',
  role: 'user',
  created_at: '2026-01-01T00:00:00Z',
};

// ── getAll ────────────────────────────────────────────────────────────────────

describe('usersApi.getAll', () => {
  it('calls GET /api/users and maps created_at → createdAt', async () => {
    mockOk([rawUser]);
    const users = await usersApi.getAll();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/users');
    expect(users[0].createdAt).toBe('2026-01-01T00:00:00Z');
  });
});

// ── getById ───────────────────────────────────────────────────────────────────

describe('usersApi.getById', () => {
  it('calls GET /api/users/:id and returns mapped user', async () => {
    mockOk(rawUser);
    const user = await usersApi.getById('u-1');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/users/u-1');
    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@test.com');
  });
});

// ── getMe ────────────────────────────────────────────────────────────────────

describe('usersApi.getMe', () => {
  it('calls GET /api/users/me', async () => {
    mockOk(rawUser);
    await usersApi.getMe();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/users/me');
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('usersApi.update', () => {
  it('sends PATCH to /api/users/:id and returns mapped user', async () => {
    mockOk({ ...rawUser, name: 'Alicia' });
    const user = await usersApi.update('u-1', { name: 'Alicia' });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/users/u-1');
    expect(options.method).toBe('PATCH');
    expect(user.name).toBe('Alicia');
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('usersApi.delete', () => {
  it('sends DELETE to /api/users/:id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    await usersApi.delete('u-1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/users/u-1');
    expect(options.method).toBe('DELETE');
  });
});

// ── getPreferences ────────────────────────────────────────────────────────────

describe('usersApi.getPreferences', () => {
  it('maps dark_mode → darkMode', async () => {
    mockOk({ dark_mode: true, language: 'he' });
    const prefs = await usersApi.getPreferences('u-1');
    expect(prefs.darkMode).toBe(true);
    expect(prefs.language).toBe('he');
  });

  it('parses availability_windows JSON string', async () => {
    const windows = { Monday: [{ id: 'w1', startTime: '09:00', endTime: '17:00' }] };
    mockOk({ dark_mode: false, availability_windows: JSON.stringify(windows), language: 'en' });
    const prefs = await usersApi.getPreferences('u-1');
    expect(prefs.availabilityWindows).toEqual(windows);
  });

  it('handles missing notification_windows gracefully', async () => {
    mockOk({ dark_mode: false, language: 'en' });
    const prefs = await usersApi.getPreferences('u-1');
    expect(prefs.notificationWindows).toEqual({});
  });
});

// ── updatePreferences ─────────────────────────────────────────────────────────

describe('usersApi.updatePreferences', () => {
  it('sends PATCH to /api/users/:id/preferences and maps result', async () => {
    mockOk({ dark_mode: false, language: 'fr' });
    const prefs = await usersApi.updatePreferences('u-1', { dark_mode: false, language: 'fr' });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/users/u-1/preferences');
    expect(options.method).toBe('PATCH');
    expect(prefs.darkMode).toBe(false);
    expect(prefs.language).toBe('fr');
  });
});

// ── Error propagation ─────────────────────────────────────────────────────────

describe('usersApi — error handling', () => {
  it('throws ApiError with status 404 when user not found', async () => {
    mockError(404, 'User not found');
    await expect(usersApi.getById('nobody')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'User not found',
    });
  });
});
