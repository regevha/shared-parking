import { messagesApi } from '../messages';
import { ApiError } from '../client';

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

const rawMessage = {
  id: 1,
  request_id: 'REQ-001',
  sender_id: 'u-1',
  sender_name: 'Alice',
  sender_role: 'user',
  text: 'Hello',
  sent_at: '2026-04-09T10:00:00Z',
};

// ── messagesApi.getForRequest ─────────────────────────────────────────────────

describe('messagesApi.getForRequest', () => {
  it('calls /api/requests/:id/messages', async () => {
    mockOk([rawMessage]);
    await messagesApi.getForRequest('REQ-001');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/requests/REQ-001/messages');
  });

  it('maps snake_case fields to camelCase', async () => {
    mockOk([rawMessage]);
    const [msg] = await messagesApi.getForRequest('REQ-001');
    expect(msg.requestId).toBe('REQ-001');
    expect(msg.senderId).toBe('u-1');
    expect(msg.senderName).toBe('Alice');
    expect(msg.senderRole).toBe('user');
    expect(msg.sentAt).toBe('2026-04-09T10:00:00Z');
  });

  it('returns an array of mapped messages', async () => {
    mockOk([rawMessage, { ...rawMessage, id: 2, text: 'World' }]);
    const msgs = await messagesApi.getForRequest('REQ-001');
    expect(msgs).toHaveLength(2);
    expect(msgs[1].text).toBe('World');
  });
});

// ── messagesApi.send ─────────────────────────────────────────────────────────

describe('messagesApi.send', () => {
  it('POSTs { text } to /api/requests/:id/messages', async () => {
    mockOk(rawMessage, 201);
    await messagesApi.send('REQ-001', 'Hello');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/requests/REQ-001/messages');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ text: 'Hello' });
  });

  it('returns a mapped Message', async () => {
    mockOk(rawMessage, 201);
    const msg = await messagesApi.send('REQ-001', 'Hello');
    expect(msg.senderName).toBe('Alice');
    expect(msg.sentAt).toBe('2026-04-09T10:00:00Z');
  });
});

// ── Error propagation ────────────────────────────────────────────────────────

describe('messagesApi — error handling', () => {
  it('throws ApiError on non-ok response', async () => {
    mockError(403, 'Forbidden');
    await expect(messagesApi.getForRequest('REQ-001')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
    });
  });
});
