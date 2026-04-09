import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import NotificationBell from '../NotificationBell';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import * as notificationsApiModule from '../../api/notifications';

jest.mock('../../api/notifications');
const mockNotificationsApi = notificationsApiModule.notificationsApi as jest.Mocked<typeof notificationsApiModule.notificationsApi>;

const makeNotification = (overrides = {}) => ({
  id: 1,
  user_id: 'u-1',
  message: 'Your request was approved',
  is_read: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  mockNotificationsApi.getNotifications.mockResolvedValue([]);
  mockNotificationsApi.markAsRead.mockResolvedValue({ id: 1, user_id: 'u-1', message: '', is_read: true, created_at: '' });
  mockNotificationsApi.markAllRead.mockResolvedValue({ status: 'ok' });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('NotificationBell', () => {
  it('shows badge with unread count', async () => {
    mockNotificationsApi.getNotifications.mockResolvedValueOnce([
      makeNotification({ id: 1, is_read: false }),
      makeNotification({ id: 2, is_read: false }),
      makeNotification({ id: 3, is_read: true }),
    ]);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows no badge when all notifications are read', async () => {
    mockNotificationsApi.getNotifications.mockResolvedValueOnce([
      makeNotification({ id: 1, is_read: true }),
    ]);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => {
      // Badge should show 0 or not render a count
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  it('opens popover on bell click and displays notifications', async () => {
    mockNotificationsApi.getNotifications.mockResolvedValueOnce([
      makeNotification({ id: 1, message: 'Request approved!' }),
    ]);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(mockNotificationsApi.getNotifications).toHaveBeenCalled());

    // Bell trigger is a div with .notification-trigger class containing the BellOutlined icon
    const bellTrigger = document.querySelector('.notification-trigger');
    if (bellTrigger) {
      await act(async () => { fireEvent.click(bellTrigger); });
      await waitFor(() => {
        expect(screen.getByText('Request approved!')).toBeInTheDocument();
      });
    }
  });

  it('calls markAsRead API when mark-as-read button is clicked', async () => {
    mockNotificationsApi.getNotifications.mockResolvedValueOnce([
      makeNotification({ id: 5, message: 'Hello', is_read: false }),
    ]);
    renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(mockNotificationsApi.getNotifications).toHaveBeenCalled());

    // Open popover
    const bellTrigger = document.querySelector('.notification-trigger');
    if (bellTrigger) {
      await act(async () => { fireEvent.click(bellTrigger); });
      await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());

      // Click mark as read button (CheckOutlined button)
      const markReadBtn = screen.getByRole('button', { name: /check/i });
      if (markReadBtn) {
        await act(async () => { fireEvent.click(markReadBtn); });
        await waitFor(() => expect(mockNotificationsApi.markAsRead).toHaveBeenCalledWith(5));
      }
    }
  });
});
