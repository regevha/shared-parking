import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import CalendarView from '../CalendarView';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest, makeUser } from '../../test-utils/fixtures';
import { RequestStatus } from '../../types/enums';

// react-big-calendar requires a real browser layout engine. Stub it so we
// can test CalendarView's own business logic (stats, view toggles, dedup).
jest.mock('react-big-calendar', () => ({
  Calendar: ({ components }: any) => <div data-testid="calendar-stub" />,
  dayjsLocalizer: () => ({}),
  Views: { WEEK: 'week', DAY: 'day', MONTH: 'month' },
}));

// Ant Design DatePicker crashes in jsdom due to @rc-component/picker needing a
// full dayjs locale setup. Stub it so CalendarView renders without locale errors.
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  DatePicker: ({ value, onChange, ...rest }: any) => (
    <input data-testid="date-picker" type="date" readOnly />
  ),
}));

describe('CalendarView', () => {
  it('renders without crashing with empty requests', async () => {
    const { container } = renderWithProviders(<CalendarView />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [], approvedRequests: [], userRequests: [] },
    });
    // CalendarView container renders
    await waitFor(() => {
      expect(container.querySelector('.calendar-view')).toBeInTheDocument();
    });
  });

  it('shows stats with zero counts when no requests', async () => {
    renderWithProviders(<CalendarView />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [], approvedRequests: [], userRequests: [] },
    });
    await waitFor(() => {
      // Multiple "0" counts in stats
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });
  });

  it('shows correct total stats count with requests', async () => {
    const pending  = makeParkingRequest({ status: RequestStatus.PENDING });
    const approved = makeParkingRequest({ status: RequestStatus.APPROVED });
    renderWithProviders(<CalendarView />, {
      authValue: { user: makeUser() },
      requestsValue: {
        pendingRequests: [pending],
        approvedRequests: [approved],
        userRequests: [pending],
      },
    });
    await waitFor(() => {
      // 2 total (1 pending + 1 approved)
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('deduplicates requests that appear in multiple lists', async () => {
    // Same request ID in both pendingRequests and userRequests
    const req = makeParkingRequest({ status: RequestStatus.PENDING });
    renderWithProviders(<CalendarView />, {
      authValue: { user: makeUser() },
      requestsValue: {
        pendingRequests: [req],
        approvedRequests: [],
        userRequests: [req], // same ID — should not be counted twice
      },
    });
    await waitFor(() => {
      // Stats should show 1, not 2
      const ones = screen.getAllByText('1');
      expect(ones.length).toBeGreaterThan(0);
    });
    // Should not show "2" for total
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('renders the calendar stub without errors', async () => {
    renderWithProviders(<CalendarView />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [], approvedRequests: [], userRequests: [] },
    });
    await waitFor(() => {
      expect(screen.getByTestId('calendar-stub')).toBeInTheDocument();
    });
  });

  it('renders the legend section', async () => {
    renderWithProviders(<CalendarView />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [], approvedRequests: [], userRequests: [] },
    });
    // Legend shows request status labels (Pending, Approved, Rejected, Mine)
    await waitFor(() => {
      expect(screen.getByText(/legend/i)).toBeInTheDocument();
    });
  });

  it('shows pending and approved request counts in stats', async () => {
    const pending  = [makeParkingRequest({ status: RequestStatus.PENDING })];
    const approved = [makeParkingRequest({ status: RequestStatus.APPROVED })];
    renderWithProviders(<CalendarView />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: pending, approvedRequests: approved, userRequests: pending },
    });
    await waitFor(() => {
      // Stats show pending count (1) and approved count (1)
      const statOnes = screen.getAllByText('1');
      expect(statOnes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
