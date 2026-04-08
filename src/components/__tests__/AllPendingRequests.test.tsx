import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { notification, Modal } from 'antd';
import AllPendingRequests from '../AllPendingRequests';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest, makeOwnerUser, makeUser } from '../../test-utils/fixtures';
import { UserRole } from '../../types/enums';

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

describe('AllPendingRequests - Owner role actions', () => {
  it('renders correctly for Owner role', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      // Check for Requester Name instead of ID, as ID is not in columns
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });
  });

  it('filters out already rejected requests by default', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    });
  });

  it('shows rejected requests when switched to All', async () => {
    // Note: Ant Design Segmented component change
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    
    // Switch to 'Show all' (translated from filterAll i18n key)
    const allButton = screen.getByText('Show all');
    fireEvent.click(allButton);

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });
});

describe('AllPendingRequests - User role actions', () => {
  it('renders correctly for User role', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.USER} />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    });
  });

  it('shows No actions for User role', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.USER} />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    });
  });
});

describe('AllPendingRequests - Manager role', () => {
  it('shows Approve/Reject for Manager role', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.MANAGER} />, {
      authValue: { user: { ...owner, role: UserRole.MANAGER } as any },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });
});

// ── Selection & Flow ──────────────────────────────────────────────────────────

describe('AllPendingRequests - selection and approval', () => {
  it('opens approval modal when clicking Approve', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    
    const approveBtn = await screen.findByText('Approve');
    fireEvent.click(approveBtn);
    
    // Antd Modal.confirm is mocked in this test file (line 10), so it won't render to DOM.
    // We check if it was called instead.
    expect(Modal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Approve Request',
      })
    );
  });

  it('disables actions for the users own request if they are not manager', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.USER} />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [makeParkingRequest({ requesterId: 'user-id-1' })] },
    });
    await waitFor(() => {
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    });
  });
});

// ── Filter toggle visibility ──────────────────────────────────────────────────

describe('AllPendingRequests - filter toggle', () => {
  it('renders correctly for Owner role', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [] },
    });
  });
});

// ── Filter mode behaviour ─────────────────────────────────────────────────────

describe('AllPendingRequests - filterMode', () => {
  it('hides rejected requests by default for owners (filterMode=active)', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    });
  });

  it('shows all requests including rejected when Show all is selected', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest, rejectedReq] },
    });
    fireEvent.click(screen.getByText('Show all'));
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });

  it('shows all requests again when Show all is clicked', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
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
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [rejectedReq] },
    });
    expect(screen.getByText('Rejected by You')).toBeInTheDocument();
  });

  it('does not show Rejected by You stat card for User role', () => {
    renderWithProviders(<AllPendingRequests role={UserRole.USER} />, {
      authValue: { user: otherUser },
      requestsValue: { pendingRequests: [] },
    });
    expect(screen.queryByText('Rejected by You')).not.toBeInTheDocument();
  });

  it('shows correct Total Requests count', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
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
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [ownRequest] },
    });
    await waitFor(() => {
      expect(screen.getByText('(You)')).toBeInTheDocument();
    });
  });

  it('does not show (You) tag for another users request', async () => {
    renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: owner },
      requestsValue: { pendingRequests: [otherRequest] },
    });
    await waitFor(() => {
      expect(screen.queryByText('(You)')).not.toBeInTheDocument();
    });
  });
});
