/**
 * Characterization tests for LotCalendarView (phase-0 safety net for the refactor).
 * react-big-calendar is stubbed (it needs a real layout engine): the stub renders the
 * events it is given as buttons, so we can pin event derivation, filtering, stats and
 * the approve/reject flow without depending on calendar internals.
 */
import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import dayjs from 'dayjs';
import LotCalendarView from '../LotCalendarView';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest, makeLot, makeOwnerUser, makeManagerUser } from '../../test-utils/fixtures';
import { RequestStatus, LotStatus } from '../../types/enums';

jest.mock('react-big-calendar', () => ({
  Calendar: ({ events, onSelectEvent }: any) => (
    <ul data-testid="calendar-stub">
      {events.map((e: any) => (
        <li key={e.id}><button onClick={() => onSelectEvent(e)}>{e.title}</button></li>
      ))}
    </ul>
  ),
  dayjsLocalizer: () => ({}),
  Views: { WEEK: 'week', DAY: 'day', MONTH: 'month' },
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  DatePicker: () => <input data-testid="date-picker" type="date" readOnly />,
}));

const owner = makeOwnerUser(); // name: 'Sarah Smith'
const lot = makeLot({ id: 'A-01' });

const booked = makeParkingRequest({
  id: 'b1', status: RequestStatus.APPROVED, requesterName: 'Bob Brown',
  lotId: 'A-01', lotOwner: 'Sarah Smith',
});
const bookedOther = makeParkingRequest({
  id: 'b2', status: RequestStatus.APPROVED, requesterName: 'Carol Cole',
  lotId: 'Z-09', lotOwner: 'Someone Else',
});
const pending = makeParkingRequest({ id: 'p1', status: RequestStatus.PENDING, requesterName: 'Alice Johnson' });
const rejectedPending = makeParkingRequest({
  id: 'p2', status: RequestStatus.PENDING, requesterName: 'Dave Dunn', rejectedByOwner: true,
});
const oldBooked = makeParkingRequest({
  id: 'b3', status: RequestStatus.APPROVED, requesterName: 'Old Timer', lotId: 'A-01',
  lotOwner: 'Sarah Smith', date: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
  endDate: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
});
const blockedLot = makeLot({
  id: 'B-02', status: LotStatus.BLOCKED, blockedUntil: dayjs().add(3, 'day').toISOString(),
});

function renderIt(over: Record<string, unknown> = {}, user = owner) {
  const approveRequest = jest.fn();
  const rejectRequest = jest.fn();
  renderWithProviders(<LotCalendarView />, {
    authValue: { user },
    requestsValue: {
      approvedRequests: [booked, bookedOther, oldBooked],
      pendingRequests: [pending, rejectedPending],
      ownerLots: [lot, blockedLot],
      allLots: [lot, blockedLot, makeLot({ id: 'Z-09' })],
      approveRequest, rejectRequest,
      ...over,
    },
  });
  return { approveRequest, rejectRequest };
}

describe('LotCalendarView', () => {
  it('shows only the owner’s upcoming bookings, live pending requests and blocked lots', async () => {
    renderIt();
    expect(await screen.findByRole('button', { name: 'Bob · A-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '⏳ Alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🔒 B-02' })).toBeInTheDocument();
    // other owner's booking, owner-rejected pending, and bookings before yesterday are hidden
    expect(screen.queryByRole('button', { name: /Carol/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dave/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Old/ })).not.toBeInTheDocument();
  });

  it('shows the stats totals (booked 1, pending 1, blocked 1, total 3)', async () => {
    renderIt();
    for (const [label, value] of [['Total Events', '3'], ['Booked', '1'], ['Pending', '1'], ['Blocked', '1']]) {
      const el = (await screen.findAllByText(label)).find(n => n.closest('div')?.textContent?.includes(value));
      expect(el).toBeTruthy();
    }
  });

  it('a manager sees every upcoming booking', async () => {
    renderIt({}, makeManagerUser());
    expect(await screen.findByRole('button', { name: 'Bob · A-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carol · Z-09' })).toBeInTheDocument();
  });

  it('opens the booked-event modal with request details', async () => {
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: 'Bob · A-01' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Booked — Bob Brown')).toBeInTheDocument();
    expect(within(dialog).getByText('b1')).toBeInTheDocument();
  });

  it('approves a pending request with the first available lot and confirms', async () => {
    const { approveRequest } = renderIt();
    fireEvent.click(await screen.findByRole('button', { name: '⏳ Alice' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(approveRequest).toHaveBeenCalledWith('p1', { lotId: 'A-01', floor: 'Floor A', lotOwner: 'Sarah Smith' });
    expect(await screen.findByText('Request approved successfully')).toBeInTheDocument();
  });

  it('rejects a pending request', async () => {
    const { rejectRequest } = renderIt();
    fireEvent.click(await screen.findByRole('button', { name: '⏳ Alice' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(rejectRequest).toHaveBeenCalledWith('p1');
  });

  it('shows the lot selector with the owner’s lots', async () => {
    renderIt();
    expect(await screen.findByLabelText(/lot/i, { selector: 'input' })).toBeInTheDocument();
  });
});
