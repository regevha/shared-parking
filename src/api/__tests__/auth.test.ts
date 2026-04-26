import { authApi } from '../auth';

// ── fetch mock setup ─────────────────────────────────────────────────────────

const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch;
});
beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
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

// ── authApi.login ─────────────────────────────────────────────────────────────

describe('authApi.login', () => {
  const serverResponse = {
    access_token: 'tok123',
    token_type: 'bearer',
    user_id: 'u-1',
    name: 'Alice',
    email: 'alice@test.com',
    role: 'user',
    preferences: {
      dark_mode: false,
      availability_windows: null,
      notification_windows: null,
      language: 'en',
    },
  };

  it('sends form-encoded POST to /auth/login', async () => {
    mockOk(serverResponse);
    await authApi.login('alice@test.com', 'password');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(options.body).toContain('username=alice%40test.com');
    expect(options.body).toContain('password=password');
  });

  it('maps user_id → id in response', async () => {
    mockOk(serverResponse);
    const result = await authApi.login('alice@test.com', 'password');
    expect(result.id).toBe('u-1');
  });

  it('maps preferences — dark_mode → darkMode', async () => {
    mockOk({ ...serverResponse, preferences: { dark_mode: true, language: 'he' } });
    const result = await authApi.login('alice@test.com', 'pw');
    expect(result.preferences.darkMode).toBe(true);
    expect(result.preferences.language).toBe('he');
  });

  it('parses availability_windows JSON string', async () => {
    const windows = { Monday: [{ id: 'w1', startTime: '08:00', endTime: '17:00' }] };
    mockOk({
      ...serverResponse,
      preferences: { dark_mode: false, availability_windows: JSON.stringify(windows), language: 'en' },
    });
    const result = await authApi.login('a@b.com', 'pw');
    expect(result.preferences.availabilityWindows).toEqual(windows);
  });

  it('throws Error with detail message on failed login', async () => {
    mockError(401, 'Incorrect email or password');
    await expect(authApi.login('bad@test.com', 'wrong')).rejects.toThrow('Incorrect email or password');
  });

  it('throws fallback message when error body is unparseable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('invalid json'); },
    });
    await expect(authApi.login('a@b.com', 'pw')).rejects.toThrow('Login failed');
  });
});

// ── authApi.me ────────────────────────────────────────────────────────────────

describe('authApi.me', () => {
  const serverUser = {
    id: 'u-2',
    name: 'Bob',
    email: 'bob@test.com',
    role: 'owner',
    preferences: { dark_mode: true, language: 'fr' },
  };

  it('sends GET to /auth/me with Bearer token from localStorage', async () => {
    localStorage.setItem('parking_token', 'my-token');
    mockOk(serverUser);
    await authApi.me();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/auth/me');
    expect(options.headers.Authorization).toBe('Bearer my-token');
  });

  it('maps preferences including dark_mode → darkMode', async () => {
    localStorage.setItem('parking_token', 'tok');
    mockOk(serverUser);
    const result = await authApi.me();
    expect(result.preferences.darkMode).toBe(true);
    expect(result.preferences.language).toBe('fr');
  });

  it('throws Error when token is invalid', async () => {
    mockError(401, 'Token invalid');
    await expect(authApi.me()).rejects.toThrow('Token invalid');
  });
});
