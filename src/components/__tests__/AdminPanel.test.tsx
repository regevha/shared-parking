import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { notification } from 'antd';
import AdminPanel from '../AdminPanel';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeUser, makeOwnerUser, makeManagerUser, makeLot, makeParkingRequest } from '../../test-utils/fixtures';

// ── Mock the three API modules ───────────────────────────────────────────────
jest.mock('../../api/users', () => ({
  usersApi: {
    getAll:  jest.fn(),
    update:  jest.fn(),
    delete:  jest.fn(),
  },
}));

jest.mock('../../api/lots', () => ({
  lotsApi: {
    getAll:  jest.fn(),
    update:  jest.fn(),
  },
}));

jest.mock('../../api/requests', () => ({
  requestsApi: {
    getAll: jest.fn(),
  },
}));

// Silence antd notification portals in jsdom
jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));
jest.spyOn(notification, 'info').mockImplementation(() => ({ destroy: jest.fn() }));

// Grab the mocked modules
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { usersApi }    = require('../../api/users');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { lotsApi }     = require('../../api/lots');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requestsApi } = require('../../api/requests');

// ── Shared test data ─────────────────────────────────────────────────────────
const alice   = makeUser({ id: 'u1', name: 'Alice Johnson', email: 'alice@parking.dev', role: 'user' });
const sarah   = makeOwnerUser({ id: 'u2', name: 'Sarah Smith', email: 'sarah@parking.dev' });
const admin   = makeManagerUser({ id: 'u3', name: 'Admin User', email: 'admin@parking.dev' });

const ownedLot   = makeLot({ id: 'LOT-001', floorLabel: 'P1-A', floor: 'F1', status: 'available', owner: 'Sarah Smith', ownerId: 'u2' });
const unownedLot = makeLot({ id: 'LOT-002', floorLabel: 'P2-B', floor: 'F2', status: 'unowned',   owner: null,          ownerId: null });

const pendingReq  = makeParkingRequest({ id: 'REQ-001', status: 'pending',  requesterName: 'Alice Johnson' });
const approvedReq = makeParkingRequest({ id: 'REQ-002', status: 'approved', requesterName: 'Alice Johnson' });
const rejectedReq = makeParkingRequest({ id: 'REQ-003', status: 'rejected', requesterName: 'Bob' });

// ── Helper: set up default API responses and render ──────────────────────────
function setup(overrides: {
  users?: any[];
  lots?: any[];
  requests?: any[];
} = {}) {
  usersApi.getAll.mockResolvedValue(overrides.users    ?? [alice, sarah, admin]);
  lotsApi.getAll.mockResolvedValue(overrides.lots      ?? [ownedLot, unownedLot]);
  requestsApi.getAll.mockResolvedValue(overrides.requests ?? [pendingReq, approvedReq, rejectedReq]);

  return renderWithProviders(<AdminPanel />, {
    authValue: { user: admin },
  });
}

// ── User Management ──────────────────────────────────────────────────────────
describe('AdminPanel — User Management', () => {
  it('renders users from the API', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Sarah Smith')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
  });

  it('renders user emails', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByText('alice@parking.dev')).toBeInTheDocument();
    });
  });

  it('Delete button is disabled for manager-role users', async () => {
    setup();
    await waitFor(() => screen.getByText('Admin User'));
    // There should be 3 Delete buttons; the one for the manager row must be disabled
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    // Manager row button is disabled
    const disabledButtons = deleteButtons.filter(btn => btn.hasAttribute('disabled'));
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows an error notification when the API fails', async () => {
    usersApi.getAll.mockRejectedValue(new Error('Network error'));
    lotsApi.getAll.mockResolvedValue([]);
    requestsApi.getAll.mockResolvedValue([]);
    renderWithProviders(<AdminPanel />, { authValue: { user: admin } });
    await waitFor(() => {
      expect(notification.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to load admin data' })
      );
    });
  });
});

// ── Lot Management ───────────────────────────────────────────────────────────
describe('AdminPanel — Lot Management', () => {
  it('renders lots from the API after clicking Lot Management', async () => {
    setup();
    fireEvent.click(screen.getByText('Lot Management'));
    await waitFor(() => {
      // floorLabel values rendered in the Floor Label column
      expect(screen.getAllByText('P1-A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('P2-B').length).toBeGreaterThan(0);
    });
  });

  it('shows "Assign Owner" button for unowned lots', async () => {
    setup();
    fireEvent.click(screen.getByText('Lot Management'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Assign Owner/i })).toBeInTheDocument();
    });
  });

  it('shows "Remove Owner" button for owned lots', async () => {
    setup();
    fireEvent.click(screen.getByText('Lot Management'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove Owner/i })).toBeInTheDocument();
    });
  });

  it('shows unowned-lots warning alert', async () => {
    setup();
    fireEvent.click(screen.getByText('Lot Management'));
    await waitFor(() => {
      expect(screen.getByText(/1 lot without an owner/i)).toBeInTheDocument();
    });
  });

  it('filter "Unowned" shows only unowned lots', async () => {
    setup();
    fireEvent.click(screen.getByText('Lot Management'));
    await waitFor(() => screen.getAllByText('P1-A')); // data loaded
    fireEvent.click(screen.getByRole('button', { name: /Unowned \(/i }));
    await waitFor(() => {
      expect(screen.queryByText('P1-A')).not.toBeInTheDocument();
      expect(screen.getAllByText('P2-B').length).toBeGreaterThan(0);
    });
  });

  it('filter "Available" shows only available lots', async () => {
    setup();
    fireEvent.click(screen.getByText('Lot Management'));
    await waitFor(() => screen.getAllByText('P1-A'));
    fireEvent.click(screen.getByRole('button', { name: /Available \(/i }));
    await waitFor(() => {
      expect(screen.getAllByText('P1-A').length).toBeGreaterThan(0);
      expect(screen.queryByText('P2-B')).not.toBeInTheDocument();
    });
  });

  it('Assign Owner modal opens when "Assign Owner" is clicked', async () => {
    setup();
    fireEvent.click(screen.getByText('Lot Management'));
    await waitFor(() => screen.getByRole('button', { name: /Assign Owner/i }));
    fireEvent.click(screen.getByRole('button', { name: /Assign Owner/i }));
    await waitFor(() => {
      expect(screen.getByText('Assign Owner to Lot')).toBeInTheDocument();
    });
  });
});

// ── Reports ──────────────────────────────────────────────────────────────────
describe('AdminPanel — Reports', () => {
  it('renders requests from the API after clicking Reports', async () => {
    setup();
    fireEvent.click(screen.getByText('Reports'));
    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('REQ-002')).toBeInTheDocument();
      expect(screen.getByText('REQ-003')).toBeInTheDocument();
    });
  });

  it('shows All tab with correct count', async () => {
    setup();
    fireEvent.click(screen.getByText('Reports'));
    await waitFor(() => {
      expect(screen.getByText('All (3)')).toBeInTheDocument();
    });
  });

  it('Pending tab filters to pending requests only', async () => {
    setup();
    fireEvent.click(screen.getByText('Reports'));
    await waitFor(() => screen.getByText('All (3)'));
    fireEvent.click(screen.getByText('Pending (1)'));
    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.queryByText('REQ-002')).not.toBeInTheDocument();
      expect(screen.queryByText('REQ-003')).not.toBeInTheDocument();
    });
  });

  it('Approved tab filters to approved requests only', async () => {
    setup();
    fireEvent.click(screen.getByText('Reports'));
    await waitFor(() => screen.getByText('All (3)'));
    fireEvent.click(screen.getByText('Approved (1)'));
    await waitFor(() => {
      expect(screen.getByText('REQ-002')).toBeInTheDocument();
      expect(screen.queryByText('REQ-001')).not.toBeInTheDocument();
    });
  });

  it('Rejected tab filters to rejected requests only', async () => {
    setup();
    fireEvent.click(screen.getByText('Reports'));
    await waitFor(() => screen.getByText('All (3)'));
    fireEvent.click(screen.getByText('Rejected (1)'));
    await waitFor(() => {
      expect(screen.getByText('REQ-003')).toBeInTheDocument();
      expect(screen.queryByText('REQ-001')).not.toBeInTheDocument();
    });
  });
});
