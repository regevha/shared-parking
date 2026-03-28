import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { notification, Modal } from 'antd';
import AllPendingRequests from '../AllPendingRequests';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest, makeOwnerUser, makeUser } from '../../test-utils/fixtures';

jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));
jest.spyOn(Modal, 'confirm').mockImplementation(() => ({ destroy: jest.fn(), update: jest.fn() }));

const owner = makeOwnerUser();
const otherUser = makeUser({ id: 'user-2', name: 'Bob' });

// A request submitted by someone other than the owner
const otherRequest = makeParkingRequest({ id: 'req-1', requesterId: 'user-2', requesterName: 'Bob' });
// A request submitted by the owner themselves
const ownRequest = makeParkingRequest({ id: 'req-2', requesterId: 'owner-1', requesterName: 'Sarah Smith' });
// A request already rejected by this owner
const rejectedReq = makeParkingRequest({ id: 'req-3', requesterId: 'user-2', requesterName: 'Charlie', rejectedByOwner: true });

// ── Role-gated action column ──────────────────────────────────────────────────

describe('AllPendingRequests - Owner role actions', () => {
  it('shows Approve and Reject buttons for another users request', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
    });
  });

  it('shows Cannot approve own request for the owners own request', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [ownRequest] },
    });
    await waitFor(() => {
      expect(screen.getByText('Cannot approve own request')).toBeInTheDocument();
    });
  });

  it('does not show Approve/Reject buttons for own request', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [ownRequest] },
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
    });
  });
});

describe('AllPendingRequests - User role actions', () => {
  it('shows No actions for User role', async () => {
    renderWithProviders(<AllPendingRequests role="User" />, {
      authValue: { user: otherUser },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.getByText('No actions')).toBeInTheDocument();
    });
  });

  it('does not show Approve/Reject buttons for User role', async () => {
    renderWithProviders(<AllPendingRequests role="User" />, {
      authValue: { user: otherUser },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    });
  });
});

describe('AllPendingRequests - Manager role actions', () => {
  it('shows No actions for Manager role', async () => {
    const mgr = makeUser({ id: 'mgr-1', role: 'manager' });
    renderWithProviders(<AllPendingRequests role="Manager" />, {
      authValue: { user: mgr },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.getByText('No actions')).toBeInTheDocument();
    });
  });
});

// ── Filter toggle visibility ──────────────────────────────────────────────────

describe('AllPendingRequests - filter toggle', () => {
  it('renders the Segmented filter for Owner role', () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [] },
    });
    expect(screen.getByText('Show all')).toBeInTheDocument();
    expect(screen.getByText('Hide already rejected')).toBeInTheDocument();
  });

  it('does not render the Segmented filter for User role', () => {
    renderWithProviders(<AllPendingRequests role="User" />, {
      authValue: { user: otherUser },
      requestsValue: { pendingRequests: [] },
    });
    expect(screen.queryByText('Show all')).not.toBeInTheDocument();
    expect(screen.queryByText('Hide already rejected')).not.toBeInTheDocument();
  });
});

// ── Filter mode behaviour ─────────────────────────────────────────────────────

describe('AllPendingRequests - filterMode', () => {
  it('shows all requests by default (filterMode=all)', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });

  it('hides rejectedByOwner requests when Hide already rejected is selected', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    fireEvent.click(screen.getByText('Hide already rejected'));
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    });
  });

  it('shows all requests again when Show all is clicked', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    fireEvent.click(screen.getByText('Hide already rejected'));
    fireEvent.click(screen.getByText('Show all'));
    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });
});

// ── Stats cards ───────────────────────────────────────────────────────────────

describe('AllPendingRequests - stats', () => {
  it('shows Rejected by You stat card for Owner role', () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [rejectedReq] },
    });
    expect(screen.getByText('Rejected by You')).toBeInTheDocument();
  });

  it('does not show Rejected by You stat card for User role', () => {
    renderWithProviders(<AllPendingRequests role="User" />, {
      authValue: { user: otherUser },
      requestsValue: { pendingRequests: [] },
    });
    expect(screen.queryByText('Rejected by You')).not.toBeInTheDocument();
  });

  it('shows correct Total Requests count', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
    });
    const statValues = screen.getAllByText('2');
    expect(statValues.length).toBeGreaterThan(0);
  });
});

// ── (You) tag ─────────────────────────────────────────────────────────────────

describe('AllPendingRequests - own request label', () => {
  it('shows (You) tag next to the owners own request name', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [ownRequest] },
    });
    await waitFor(() => {
      expect(screen.getByText('(You)')).toBeInTheDocument();
    });
  });

  it('does not show (You) tag for another users request', async () => {
    renderWithProviders(<AllPendingRequests role="Owner" />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.queryByText('(You)')).not.toBeInTheDocument();
    });
  });
});
