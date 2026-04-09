import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { notification } from 'antd';
import AllApprovals from '../AllApprovals';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest, makeUser } from '../../test-utils/fixtures';
import { RequestStatus } from '../../types/enums';

beforeEach(() => {
  jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
  jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));
});
afterEach(() => { jest.restoreAllMocks(); });

const TODAY = new Date().toISOString().split('T')[0];

function makeApproved(overrides = {}) {
  return makeParkingRequest({
    status: RequestStatus.APPROVED,
    lotId: 'LOT-A1',
    floor: 'Floor 1',
    lotOwner: 'Sarah',
    approvedAt: new Date().toISOString(),
    ...overrides,
  });
}

describe('AllApprovals', () => {
  it('renders table of approved requests', async () => {
    const req = makeApproved({ requesterName: 'Alice Johnson' });
    renderWithProviders(<AllApprovals />, {
      authValue: { user: makeUser() },
      requestsValue: { approvedRequests: [req] },
    });
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());
  });

  it('shows empty state when no approved requests', () => {
    renderWithProviders(<AllApprovals />, {
      authValue: { user: makeUser() },
      requestsValue: { approvedRequests: [] },
    });
    // Table renders with no rows — check that requester names are absent
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
  });

  it('search filters by requester name', async () => {
    const alice = makeApproved({ requesterName: 'Alice Johnson' });
    const bob   = makeApproved({ requesterName: 'Bob Smith' });
    renderWithProviders(<AllApprovals />, {
      authValue: { user: makeUser() },
      requestsValue: { approvedRequests: [alice, bob] },
    });
    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    await waitFor(() => {
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });
  });

  it('search filters by lot owner', async () => {
    const sarahLot = makeApproved({ requesterName: 'Alice Johnson', lotOwner: 'Sarah' });
    const mikeLot  = makeApproved({ requesterName: 'Bob Smith', lotOwner: 'Mike' });
    renderWithProviders(<AllApprovals />, {
      authValue: { user: makeUser() },
      requestsValue: { approvedRequests: [sarahLot, mikeLot] },
    });
    await waitFor(() => expect(screen.getAllByText(/Sarah|Mike/).length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Mike' } });

    await waitFor(() => {
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });
  });

  it('stats show total approved count', async () => {
    const reqs = [makeApproved(), makeApproved(), makeApproved()];
    renderWithProviders(<AllApprovals />, {
      authValue: { user: makeUser() },
      requestsValue: { approvedRequests: reqs },
    });
    await waitFor(() => {
      // At least one element with text "3" exists (total count stat)
      const threes = screen.getAllByText('3');
      expect(threes.length).toBeGreaterThan(0);
    });
  });

  it('"my lot only" toggle filters by current user lots', async () => {
    const myLot    = makeApproved({ requesterName: 'Alice Johnson', lotOwner: 'Alice Johnson' });
    const otherLot = makeApproved({ requesterName: 'Bob Smith', lotOwner: 'Sarah' });
    renderWithProviders(<AllApprovals />, {
      authValue: { user: makeUser({ name: 'Alice Johnson' }) },
      requestsValue: { approvedRequests: [myLot, otherLot] },
    });
    await waitFor(() => expect(screen.getByText('Bob Smith')).toBeInTheDocument());

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
    });
  });

  it('displays lot assignment info (lot ID)', async () => {
    const req = makeApproved({ lotId: 'LOT-X99' });
    renderWithProviders(<AllApprovals />, {
      authValue: { user: makeUser() },
      requestsValue: { approvedRequests: [req] },
    });
    await waitFor(() => expect(screen.getByText('LOT-X99')).toBeInTheDocument());
  });
});
