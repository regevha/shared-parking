import { requestsApi } from '../requests';
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

/** Helper: make fetch resolve with a JSON body and the given status */
function mockOk(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => body,
  });
}

/** Helper: make fetch reject with the given HTTP error */
function mockError(status: number, detail = 'Something went wrong') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ detail }),
  });
}

// ── Snake-case → camelCase mapping ───────────────────────────────────────────

describe('requestsApi.getPending — field mapping', () => {
  const serverRequest = {
    id: 'req-1',
    requester_id: 'user-42',
    requester_name: 'Alice Johnson',
    date: '2026-04-01',
    start_time: '09:00',
    end_time: '10:00',
    duration: 1,
    submitted_at: '2026-03-28T08:00:00Z',
    status: 'pending',
    rejected_by_owner: null,
    lot_id: null,
    floor: null,
    lot_owner: null,
    approved_at: null,
  };

  it('maps snake_case fields to camelCase', async () => {
    mockOk([serverRequest]);
    const [req] = await requestsApi.getPending();
    expect(req.requesterId).toBe('user-42');
    expect(req.requesterName).toBe('Alice Johnson');
    expect(req.startTime).toBe('09:00');
    expect(req.endTime).toBe('10:00');
    expect(req.submittedAt).toBe('2026-03-28T08:00:00Z');
  });

  it('maps rejected_by_owner: null → false', async () => {
    mockOk([{ ...serverRequest, rejected_by_owner: null }]);
    const [req] = await requestsApi.getPending();
    expect(req.rejectedByOwner).toBe(false);
  });

  it('maps rejected_by_owner: true → true', async () => {
    mockOk([{ ...serverRequest, rejected_by_owner: true }]);
    const [req] = await requestsApi.getPending();
    expect(req.rejectedByOwner).toBe(true);
  });

  it('maps lot_id: null → undefined (not null)', async () => {
    mockOk([{ ...serverRequest, lot_id: null }]);
    const [req] = await requestsApi.getPending();
    expect(req.lotId).toBeUndefined();
  });

  it('maps lot_id present → string value', async () => {
    mockOk([{ ...serverRequest, lot_id: 'A-01', floor: '1', lot_owner: 'Sarah' }]);
    const [req] = await requestsApi.getPending();
    expect(req.lotId).toBe('A-01');
    expect(req.floor).toBe('1');
    expect(req.lotOwner).toBe('Sarah');
  });

  it('maps floor: null → undefined', async () => {
    mockOk([{ ...serverRequest, floor: null }]);
    const [req] = await requestsApi.getPending();
    expect(req.floor).toBeUndefined();
  });

  it('maps approved_at: null → undefined', async () => {
    mockOk([{ ...serverRequest, approved_at: null }]);
    const [req] = await requestsApi.getPending();
    expect(req.approvedAt).toBeUndefined();
  });

  it('maps approved_at present → string value', async () => {
    mockOk([{ ...serverRequest, approved_at: '2026-04-01T09:00:00Z' }]);
    const [req] = await requestsApi.getPending();
    expect(req.approvedAt).toBe('2026-04-01T09:00:00Z');
  });
});

// ── approve — sends correct PATCH body ──────────────────────────────────────

describe('requestsApi.approve', () => {
  const baseResponse = {
    id: 'req-1', requester_id: 'u1', requester_name: 'Alice', date: '2026-04-01',
    start_time: '09:00', end_time: '10:00', duration: 1, submitted_at: '2026-03-28T08:00:00Z',
    status: 'approved', rejected_by_owner: false, lot_id: 'A-01',
    floor: '1', lot_owner: 'Sarah', approved_at: '2026-04-01T09:00:00Z',
  };

  it('sends PATCH to /api/requests/:id/approve with lot info', async () => {
    mockOk(baseResponse);
    await requestsApi.approve('req-1', { lot_id: 'A-01', floor: '1', lot_owner: 'Sarah' });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/requests/req-1/approve');
    expect(options.method).toBe('PATCH');
    const body = JSON.parse(options.body);
    expect(body.lot_id).toBe('A-01');
    expect(body.floor).toBe('1');
    expect(body.lot_owner).toBe('Sarah');
  });

  it('sends PATCH without lot info when omitted', async () => {
    mockOk(baseResponse);
    await requestsApi.approve('req-1');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.lot_id).toBeUndefined();
    expect(body.floor).toBeUndefined();
    expect(body.lot_owner).toBeUndefined();
  });
});

// ── create — sends correct POST body ────────────────────────────────────────

describe('requestsApi.create', () => {
  it('POSTs snake_case payload and maps response', async () => {
    const serverResponse = {
      id: 'req-99', requester_id: 'u1', requester_name: 'Alice', date: '2026-04-02',
      start_time: '10:00', end_time: '12:00', duration: 2, submitted_at: '2026-03-28T09:00:00Z',
      status: 'pending', rejected_by_owner: null, lot_id: null,
      floor: null, lot_owner: null, approved_at: null,
    };
    mockOk(serverResponse, 201);

    const result = await requestsApi.create({
      requester_id: 'u1',
      requester_name: 'Alice',
      date: '2026-04-02',
      start_time: '10:00',
      end_date: '2026-04-02',
      end_time: '12:00',
      duration: 2,
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/requests');
    expect(options.method).toBe('POST');
    expect(result.id).toBe('req-99');
    expect(result.status).toBe('pending');
  });
});

// ── ApiError on non-ok responses ─────────────────────────────────────────────

describe('ApiError', () => {
  it('throws ApiError with correct status on 401', async () => {
    mockError(401, 'Not authenticated');
    await expect(requestsApi.getPending()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Not authenticated',
    });
  });

  it('throws ApiError with correct status on 403', async () => {
    mockError(403, 'Forbidden');
    await expect(requestsApi.getPending()).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
    });
  });

  it('throws ApiError with fallback message on 500 without detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(requestsApi.getPending()).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'HTTP 500',
    });
  });
});

// ── Auth header ──────────────────────────────────────────────────────────────

describe('auth header', () => {
  it('attaches Bearer token from localStorage when present', async () => {
    localStorage.setItem('parking_token', 'my-jwt-token');
    mockOk([]);
    await requestsApi.getPending();
    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('omits Authorization header when no token in localStorage', async () => {
    mockOk([]);
    await requestsApi.getPending();
    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });
});
