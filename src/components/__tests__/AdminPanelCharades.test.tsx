import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { notification } from 'antd';
import AdminPanel from '../AdminPanel';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeUser, makeManagerUser } from '../../test-utils/fixtures';

// ── Mock APIs ───────────────────────────────────────────────────────────────
jest.mock('../../api/users', () => ({
  usersApi: { getAll: jest.fn(() => Promise.resolve([])) }
}));
jest.mock('../../api/lots', () => ({
  lotsApi: { getAll: jest.fn(() => Promise.resolve([])) }
}));
jest.mock('../../api/requests', () => ({
  requestsApi: { getAll: jest.fn(() => Promise.resolve([])) }
}));
jest.mock('../../api/config', () => ({
  configApi: { get: jest.fn(() => Promise.resolve({})) }
}));
jest.mock('../../api/notifications', () => ({
  notificationsApi: { broadcast: jest.fn() }
}));
jest.mock('../../api/admin', () => ({
  adminApi: {
    importUsers: jest.fn(),
    importLots: jest.fn()
  }
}));

// Grab the mocked modules
const { notificationsApi } = require('../../api/notifications');
const { adminApi } = require('../../api/admin');

// ── Tests ───────────────────────────────────────────────────────────────────
describe('AdminPanel — Real Actions (Anti-Charade)', () => {
  const manager = makeManagerUser({ id: 'm1', name: 'Manager' });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));
    jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
  });

  it('verifies Broadcast actually calls the API', async () => {
    notificationsApi.broadcast.mockResolvedValue({ status: 'ok', delivered_to: 5 });

    renderWithProviders(<AdminPanel />, { authValue: { user: manager } });

    // Navigate to Broadcast
    fireEvent.click(screen.getByText('Broadcast'));

    const input = screen.getByPlaceholderText(/broadcast message/i);
    fireEvent.change(input, { target: { value: 'Important Announcement' } });

    const sendBtn = screen.getByRole('button', { name: /Send Broadcast/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      // THE KEY CHECK: Verify API was called
      expect(notificationsApi.broadcast).toHaveBeenCalledWith('both', 'Important Announcement');
      expect(notification.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Broadcast sent'),
          description: expect.stringContaining('5 users')
        })
      );
    });
  });

  it('verifies Import actually calls the API', async () => {
    adminApi.importUsers.mockResolvedValue({ status: 'ok', imported: 10, errors: [] });

    renderWithProviders(<AdminPanel />, { authValue: { user: manager } });

    fireEvent.click(screen.getByText(/Import \/ Export/i));

    // Simulate File Upload
    const file = new File(['name,email\nTest,test@test.com'], 'users.csv', { type: 'text/csv' });
    const uploadInput = screen.getByLabelText(/Upload CSV/i); // AntD Upload uses a hidden input

    Object.defineProperty(uploadInput, 'files', { value: [file] });
    fireEvent.change(uploadInput);

    await waitFor(() => {
      expect(adminApi.importUsers).toHaveBeenCalled();
      expect(notification.success).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Import Successful' })
      );
    });
  });
});
