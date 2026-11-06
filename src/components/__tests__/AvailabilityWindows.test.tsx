/**
 * Characterization tests for AvailabilityWindows (phase-0 safety net for the refactor).
 * They pin today's behaviour: empty state, listing, toggle and delete.
 */
import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import AvailabilityWindows from '../AvailabilityWindows';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeOwnerUser, makeLot } from '../../test-utils/fixtures';
import { availabilityApi, type AvailabilityWindowData } from '../../api/availability';

jest.mock('../../api/availability', () => ({
  ...jest.requireActual('../../api/availability'),
  availabilityApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));
const mockApi = availabilityApi as jest.Mocked<typeof availabilityApi>;

const win = (over: Partial<AvailabilityWindowData> = {}): AvailabilityWindowData => ({
  id: 1, lotId: 'LOT-A', dayOfWeek: 0, specificDate: null,
  startTime: '08:00', endTime: '17:00', isActive: true, createdAt: null, ...over,
});

const lot = makeLot({ id: 'LOT-A', floorLabel: 'Floor A' });

function renderIt(ownerLots = [lot]) {
  return renderWithProviders(<AvailabilityWindows />, {
    authValue: { user: makeOwnerUser() },
    requestsValue: { ownerLots },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('AvailabilityWindows', () => {
  it('shows the "no lots" message when the owner has no lots', async () => {
    renderIt([]);
    expect(await screen.findByText(/You have no lots assigned/)).toBeInTheDocument();
    expect(mockApi.list).not.toHaveBeenCalled();
  });

  it('loads windows per lot and lists them', async () => {
    mockApi.list.mockResolvedValue([win(), win({ id: 2, dayOfWeek: 2, startTime: '09:00', endTime: '12:00' })]);
    renderIt();
    expect(await screen.findByText('08:00 – 17:00')).toBeInTheDocument();
    expect(screen.getByText('09:00 – 12:00')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Wednesday')).toBeInTheDocument();
    expect(mockApi.list).toHaveBeenCalledWith('LOT-A');
  });

  it('shows the blocked-by-default text when a lot has no windows', async () => {
    mockApi.list.mockResolvedValue([]);
    renderIt();
    expect(await screen.findByText(/this lot is fully blocked/)).toBeInTheDocument();
  });

  it('toggles a window active state through the API', async () => {
    mockApi.list.mockResolvedValue([win()]);
    mockApi.update.mockResolvedValue(win({ isActive: false }));
    renderIt();
    await screen.findByText('08:00 – 17:00');
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith('LOT-A', 1, { is_active: false }));
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeChecked());
  });

  it('deletes a window through the API and removes it from the list', async () => {
    mockApi.list.mockResolvedValue([win()]);
    mockApi.delete.mockResolvedValue(undefined);
    renderIt();
    await screen.findByText('08:00 – 17:00');
    const row = screen.getByText('08:00 – 17:00').closest('tr')!;
    const buttons = row.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1]); // the switch is also a <button>; delete is last
    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('LOT-A', 1));
    await waitFor(() => expect(screen.queryByText('08:00 – 17:00')).not.toBeInTheDocument());
  });

  it('opens the add dialog from "Add Window"', async () => {
    mockApi.list.mockResolvedValue([]);
    renderIt();
    await screen.findByText(/this lot is fully blocked/);
    fireEvent.click(screen.getByRole('button', { name: /add window/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
