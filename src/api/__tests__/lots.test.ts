import { lotsApi } from '../lots';

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

// ── Snake-case → camelCase mapping ───────────────────────────────────────────

describe('lotsApi.getAll — field mapping', () => {
  const serverLot = {
    id: 'A-01',
    floor: 'A',
    floor_label: 'Floor A',
    owner: 'Sarah',
    owner_id: 'owner-1',
    status: 'available',
    blocked_until: null,
  };

  it('maps floor_label → floorLabel', async () => {
    mockOk([serverLot]);
    const [lot] = await lotsApi.getAll();
    expect(lot.floorLabel).toBe('Floor A');
  });

  it('maps owner_id → ownerId', async () => {
    mockOk([serverLot]);
    const [lot] = await lotsApi.getAll();
    expect(lot.ownerId).toBe('owner-1');
  });

  it('maps blocked_until: null → undefined (not null)', async () => {
    mockOk([{ ...serverLot, blocked_until: null }]);
    const [lot] = await lotsApi.getAll();
    expect(lot.blockedUntil).toBeUndefined();
  });

  it('maps blocked_until present → string value', async () => {
    mockOk([{ ...serverLot, blocked_until: '2026-04-10T18:00:00Z' }]);
    const [lot] = await lotsApi.getAll();
    expect(lot.blockedUntil).toBe('2026-04-10T18:00:00Z');
  });

  it('keeps owner: null as null (not undefined)', async () => {
    mockOk([{ ...serverLot, owner: null, owner_id: null }]);
    const [lot] = await lotsApi.getAll();
    expect(lot.owner).toBeNull();
    expect(lot.ownerId).toBeNull();
  });

  it('maps status through unchanged', async () => {
    mockOk([{ ...serverLot, status: 'blocked' }]);
    const [lot] = await lotsApi.getAll();
    expect(lot.status).toBe('blocked');
  });

  it('maps an array of multiple lots', async () => {
    mockOk([serverLot, { ...serverLot, id: 'A-02', floor_label: 'Floor A', status: 'blocked' }]);
    const lots = await lotsApi.getAll();
    expect(lots).toHaveLength(2);
    expect(lots[1].id).toBe('A-02');
    expect(lots[1].status).toBe('blocked');
  });
});

// ── getMine ──────────────────────────────────────────────────────────────────

describe('lotsApi.getMine', () => {
  it('calls /api/lots/mine and maps response', async () => {
    mockOk([{ id: 'B-01', floor: 'B', floor_label: 'Floor B', owner: 'Sarah', owner_id: 'owner-1', status: 'available', blocked_until: null }]);
    const lots = await lotsApi.getMine();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/lots/mine');
    expect(lots[0].floorLabel).toBe('Floor B');
  });
});

// ── getById ──────────────────────────────────────────────────────────────────

describe('lotsApi.getById', () => {
  it('calls /api/lots/:id and maps single lot', async () => {
    mockOk({ id: 'C-03', floor: 'C', floor_label: 'Floor C', owner: null, owner_id: null, status: 'unowned', blocked_until: null });
    const lot = await lotsApi.getById('C-03');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/lots/C-03');
    expect(lot.status).toBe('unowned');
    expect(lot.owner).toBeNull();
  });
});

// ── create ───────────────────────────────────────────────────────────────────

describe('lotsApi.create', () => {
  it('POSTs payload and returns mapped lot', async () => {
    mockOk({ id: 'D-01', floor: 'D', floor_label: 'Floor D', owner: null, owner_id: null, status: 'unowned', blocked_until: null }, 201);
    const lot = await lotsApi.create({ id: 'D-01', floor: 'D', floor_label: 'Floor D' });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/lots');
    expect(options.method).toBe('POST');
    expect(lot.id).toBe('D-01');
  });
});

// ── update ───────────────────────────────────────────────────────────────────

describe('lotsApi.update', () => {
  it('sends PATCH to /api/lots/:id and returns mapped result', async () => {
    mockOk({ id: 'A-01', floor: 'A', floor_label: 'Floor A', owner: 'Sarah', owner_id: 'owner-1', status: 'blocked', blocked_until: '2026-05-01T00:00:00Z' });
    const lot = await lotsApi.update('A-01', { status: 'blocked', blocked_until: '2026-05-01T00:00:00Z' });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/lots/A-01');
    expect(options.method).toBe('PATCH');
    expect(lot.status).toBe('blocked');
    expect(lot.blockedUntil).toBe('2026-05-01T00:00:00Z');
  });
});

// ── delete ───────────────────────────────────────────────────────────────────

describe('lotsApi.delete', () => {
  it('sends DELETE to /api/lots/:id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    await lotsApi.delete('A-01');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/lots/A-01');
    expect(options.method).toBe('DELETE');
  });
});

// ── ApiError propagation ─────────────────────────────────────────────────────

describe('lotsApi — error handling', () => {
  it('throws ApiError with status 404 when lot not found', async () => {
    mockError(404, 'Lot not found');
    await expect(lotsApi.getById('NONEXISTENT')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Lot not found',
    });
  });

  it('throws ApiError with status 403 when not owner/manager', async () => {
    mockError(403, 'Forbidden');
    await expect(lotsApi.create({ id: 'X-01', floor: 'X', floor_label: 'X' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
    });
  });
});
