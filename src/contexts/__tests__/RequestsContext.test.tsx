import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { RequestsProvider, useRequests } from '../RequestsContext';
import { AuthContext } from '../AuthContext';
import * as requestsApiModule from '../../api/requests';
import * as lotsApiModule from '../../api/lots';
import { makeUser, makeOwnerUser, makeParkingRequest, makeLot } from '../../test-utils/fixtures';
import { RequestStatus } from '../../types/enums';

// ── Mock API modules ──────────────────────────────────────────────────────────

jest.mock('../../api/requests');
jest.mock('../../api/lots');

const mockRequestsApi = requestsApiModule.requestsApi as jest.Mocked<typeof requestsApiModule.requestsApi>;
const mockLotsApi = lotsApiModule.lotsApi as jest.Mocked<typeof lotsApiModule.lotsApi>;

// ── Test harness ──────────────────────────────────────────────────────────────

function RequestsHarness() {
  const ctx = useRequests();
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="error">{ctx.error ?? 'null'}</div>
      <div data-testid="pending-count">{ctx.pendingRequests.length}</div>
      <div data-testid="approved-count">{ctx.approvedRequests.length}</div>
      <div data-testid="user-count">{ctx.userRequests.length}</div>
      <div data-testid="all-lots-count">{ctx.allLots.length}</div>
      <div data-testid="owner-lots-count">{ctx.ownerLots.length}</div>
      <button onClick={() => ctx.addPendingRequest({
        requesterId: 'u-1', requesterName: 'Alice',
        date: '2026-04-10', startTime: '09:00', endDate: '2026-04-10', endTime: '10:00', duration: 1,
      })}>add</button>
      <button onClick={() => ctx.approveRequest('REQ-1')}>approve</button>
      <button onClick={() => ctx.rejectRequest('REQ-1')}>reject</button>
      <button onClick={() => ctx.cancelUserRequest('REQ-1')}>cancel</button>
      <button onClick={() => ctx.updateUserRequest('REQ-1', {
        date: '2026-04-11', startTime: '10:00', endDate: '2026-04-11', endTime: '11:00', duration: 1,
      })}>update</button>
    </div>
  );
}

function renderWithUser(user: ReturnType<typeof makeUser> | null = makeUser()) {
  const authValue = {
    user,
    token: user ? 'tok' : null,
    authLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateUser: jest.fn(),
  };
  return render(
    <AuthContext.Provider value={authValue}>
      <RequestsProvider>
        <RequestsHarness />
      </RequestsProvider>
    </AuthContext.Provider>
  );
}

type ParkingRequestT = ReturnType<typeof makeParkingRequest>;
type LotT = ReturnType<typeof makeLot>;
const emptyResponse: {
  pending: ParkingRequestT[]; approved: ParkingRequestT[]; mine: ParkingRequestT[];
  lots: LotT[]; ownerLots: LotT[];
} = { pending: [], approved: [], mine: [], lots: [], ownerLots: [] };

function setupMocks(overrides: Partial<typeof emptyResponse> = {}) {
  const { pending, approved, mine, lots, ownerLots } = { ...emptyResponse, ...overrides };
  mockRequestsApi.getPending.mockResolvedValue(pending);
  mockRequestsApi.getApproved.mockResolvedValue(approved);
  mockRequestsApi.getMe.mockResolvedValue(mine);
  mockLotsApi.getAll.mockResolvedValue(lots);
  mockLotsApi.getMine.mockResolvedValue(ownerLots);
}

beforeEach(() => { jest.clearAllMocks(); });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RequestsContext — initial load', () => {
  it('does not fetch when user is null', async () => {
    renderWithUser(null);
    await new Promise(r => setTimeout(r, 50)); // let effects settle
    expect(mockRequestsApi.getPending).not.toHaveBeenCalled();
  });

  it('fetches all data when user is set (non-owner)', async () => {
    setupMocks();
    renderWithUser(makeUser());
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(mockRequestsApi.getPending).toHaveBeenCalledTimes(1);
    expect(mockRequestsApi.getApproved).toHaveBeenCalledTimes(1);
    expect(mockRequestsApi.getMe).toHaveBeenCalledTimes(1);
    expect(mockLotsApi.getAll).toHaveBeenCalledTimes(1);
    expect(mockLotsApi.getMine).not.toHaveBeenCalled();
  });

  it('fetches ownerLots when user is owner', async () => {
    setupMocks({ ownerLots: [makeLot()] });
    renderWithUser(makeOwnerUser());
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(mockLotsApi.getMine).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('owner-lots-count').textContent).toBe('1');
  });

  it('populates state from API responses', async () => {
    const req = makeParkingRequest();
    const lot = makeLot();
    setupMocks({ pending: [req], lots: [lot] });
    renderWithUser();
    await waitFor(() => expect(screen.getByTestId('pending-count').textContent).toBe('1'));
    expect(screen.getByTestId('all-lots-count').textContent).toBe('1');
  });

  it('sets error state on fetch failure', async () => {
    mockRequestsApi.getPending.mockRejectedValueOnce(new Error('API down'));
    mockRequestsApi.getApproved.mockResolvedValue([]);
    mockRequestsApi.getMe.mockResolvedValue([]);
    mockLotsApi.getAll.mockResolvedValue([]);
    renderWithUser();
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('API down'));
  });
});

describe('RequestsContext — addPendingRequest', () => {
  it('calls requestsApi.create and appends to pendingRequests and userRequests', async () => {
    setupMocks();
    const newReq = makeParkingRequest({ id: 'NEW-1', status: RequestStatus.PENDING });
    mockRequestsApi.create.mockResolvedValueOnce(newReq);
    renderWithUser();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => { screen.getByText('add').click(); });
    expect(screen.getByTestId('pending-count').textContent).toBe('1');
    expect(screen.getByTestId('user-count').textContent).toBe('1');
  });
});

describe('RequestsContext — approveRequest', () => {
  it('moves request from pending to approved', async () => {
    const req = makeParkingRequest({ id: 'REQ-1' });
    setupMocks({ pending: [req] });
    const approved = { ...req, status: RequestStatus.APPROVED };
    mockRequestsApi.approve.mockResolvedValueOnce(approved);
    renderWithUser();
    await waitFor(() => expect(screen.getByTestId('pending-count').textContent).toBe('1'));
    await act(async () => { screen.getByText('approve').click(); });
    expect(screen.getByTestId('pending-count').textContent).toBe('0');
    expect(screen.getByTestId('approved-count').textContent).toBe('1');
  });
});

describe('RequestsContext — rejectRequest', () => {
  it('updates status in pendingRequests and userRequests', async () => {
    const req = makeParkingRequest({ id: 'REQ-1' });
    setupMocks({ pending: [req], mine: [req] });
    const rejected = { ...req, status: RequestStatus.REJECTED };
    mockRequestsApi.reject.mockResolvedValueOnce(rejected);
    renderWithUser();
    await waitFor(() => expect(screen.getByTestId('pending-count').textContent).toBe('1'));
    await act(async () => { screen.getByText('reject').click(); });
    // still in lists but with updated status — count stays same
    expect(screen.getByTestId('pending-count').textContent).toBe('1');
  });
});

describe('RequestsContext — cancelUserRequest', () => {
  it('removes request from both pendingRequests and userRequests', async () => {
    const req = makeParkingRequest({ id: 'REQ-1' });
    setupMocks({ pending: [req], mine: [req] });
    mockRequestsApi.cancel.mockResolvedValueOnce(undefined as any);
    renderWithUser();
    await waitFor(() => expect(screen.getByTestId('pending-count').textContent).toBe('1'));
    await act(async () => { screen.getByText('cancel').click(); });
    expect(screen.getByTestId('pending-count').textContent).toBe('0');
    expect(screen.getByTestId('user-count').textContent).toBe('0');
  });
});

describe('RequestsContext — updateUserRequest', () => {
  it('patches request in both userRequests and pendingRequests', async () => {
    const req = makeParkingRequest({ id: 'REQ-1', date: '2026-04-10' });
    setupMocks({ pending: [req], mine: [req] });
    const updated = { ...req, date: '2026-04-11' };
    mockRequestsApi.update.mockResolvedValueOnce(updated);
    renderWithUser();
    await waitFor(() => expect(screen.getByTestId('pending-count').textContent).toBe('1'));
    await act(async () => { screen.getByText('update').click(); });
    expect(mockRequestsApi.update).toHaveBeenCalledWith('REQ-1', expect.objectContaining({ date: '2026-04-11' }));
  });
});
