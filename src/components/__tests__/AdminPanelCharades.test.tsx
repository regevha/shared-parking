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

// Mock window.matchMedia and scrollTo which antd components rely on
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  window.scrollTo = jest.fn();
});

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

    // Navigate to Broadcast - use findByText to handle antd lazy renders
    const broadcastMenu = await screen.findByText('Broadcast');
    fireEvent.click(broadcastMenu);

    const input = await screen.findByPlaceholderText(/broadcast message/i);
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
    
    // Navigate to Import/Export - use findByText
    const importMenu = await screen.findByText(/Import \/ Export/i);
    fireEvent.click(importMenu);

    // Wait for content (AntD upload button uses t('adminPanel.import.uploadButton') which is 'Upload CSV File')
    const uploadBtn = await screen.findByText(/Upload CSV File/i);
    expect(uploadBtn).toBeInTheDocument();

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
