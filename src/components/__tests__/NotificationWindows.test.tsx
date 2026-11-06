/**
 * Characterization tests for NotificationWindows (phase-0 safety net for the refactor).
 * They pin today's behaviour: rendering, per-day limit and delete/persist.
 */
import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import NotificationWindows from '../NotificationWindows';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeUser } from '../../test-utils/fixtures';
import { usersApi } from '../../api/users';

jest.mock('../../api/users');
const mockUsersApi = usersApi as jest.Mocked<typeof usersApi>;

const WINDOWS = {
  Monday: [
    { id: 'w1', startTime: '08:00', endTime: '09:00' },
    { id: 'w2', startTime: '12:00', endTime: '13:00' },
  ],
  Tuesday: [{ id: 'w3', startTime: '10:00', endTime: '11:00' }],
};

function renderIt(notificationWindows: Record<string, unknown> = WINDOWS) {
  const updateUser = jest.fn();
  const base = makeUser();
  const user = { ...base, preferences: { ...base.preferences, notificationWindows } } as typeof base;
  renderWithProviders(<NotificationWindows />, { authValue: { user, updateUser } });
  return { updateUser };
}

beforeEach(() => jest.clearAllMocks());

describe('NotificationWindows', () => {
  it('renders the title, blackout alert and all seven days', async () => {
    renderIt({});
    expect(await screen.findByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText(/No notifications are delivered between 22:00 and 06:00/)).toBeInTheDocument();
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(d =>
      expect(screen.getByText(d)).toBeInTheDocument()
    );
  });

  it('shows saved windows as time-range tags', async () => {
    renderIt();
    expect(await screen.findByText('08:00 – 09:00')).toBeInTheDocument();
    expect(screen.getByText('12:00 – 13:00')).toBeInTheDocument();
    expect(screen.getByText('10:00 – 11:00')).toBeInTheDocument();
  });

  it('disables "add" for a day that already has two windows, and only that day', async () => {
    renderIt();
    await screen.findByText('08:00 – 09:00');
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    expect(addButtons).toHaveLength(7);
    expect(addButtons[0]).toBeDisabled();   // Monday: 2 windows
    expect(addButtons[1]).toBeEnabled();    // Tuesday: 1 window
    expect(addButtons[2]).toBeEnabled();    // Wednesday: none
  });

  it('deletes a window, persists the remaining windows and updates the user', async () => {
    mockUsersApi.updatePreferences.mockResolvedValue({ notificationWindows: { Monday: [WINDOWS.Monday[1]] } } as never);
    const { updateUser } = renderIt();
    await screen.findByText('08:00 – 09:00');

    const tag = screen.getByText('08:00 – 09:00');
    fireEvent.click(tag.parentElement!.querySelector('button')!);

    await waitFor(() => expect(mockUsersApi.updatePreferences).toHaveBeenCalledTimes(1));
    const [id, payload] = mockUsersApi.updatePreferences.mock.calls[0];
    expect(id).toBe(makeUser().id);
    const saved = JSON.parse(payload.notification_windows as string);
    expect(saved.Monday).toEqual([WINDOWS.Monday[1]]);
    expect(saved.Tuesday).toEqual(WINDOWS.Tuesday);
    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('08:00 – 09:00')).not.toBeInTheDocument());
  });

  it('opens the add modal for the chosen day', async () => {
    renderIt({});
    await screen.findByText('Notification Preferences');
    fireEvent.click(screen.getAllByRole('button', { name: /add/i })[2]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
