import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { notification } from 'antd';
import AdminPanel from '../AdminPanel';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeManagerUser } from '../../test-utils/fixtures';

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
const { usersApi } = require('../../api/users');
const { lotsApi } = require('../../api/lots');
const { requestsApi } = require('../../api/requests');
const { configApi } = require('../../api/config');
const { notificationsApi } = require('../../api/notifications');
const { adminApi } = require('../../api/admin');

// matchMedia is polyfilled globally in src/setupTests.ts (a jest.fn here would be reset between tests)
beforeAll(() => {
  window.scrollTo = jest.fn();
});

// ── Tests ───────────────────────────────────────────────────────────────────
describe('AdminPanel — Real Actions (Anti-Charade)', () => {
  const manager = makeManagerUser({ id: 'm1', name: 'Manager' });

  beforeEach(() => {
    jest.clearAllMocks();
    // CRA resets mock implementations between tests, so the default loaders are restored here
    usersApi.getAll.mockResolvedValue([]);
    lotsApi.getAll.mockResolvedValue([]);
    requestsApi.getAll.mockResolvedValue([]);
    configApi.get.mockResolvedValue({});
    jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));
    jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies Broadcast actually calls the API', async () => {
    notificationsApi.broadcast.mockResolvedValue({ status: 'ok', delivered_to: 5 });

    renderWithProviders(<AdminPanel />, { authValue: { user: manager } });

    // Navigate to Broadcast - use findByText to handle antd lazy renders
    const broadcastMenu = await screen.findByText('Broadcast', {}, { timeout: 5000 });
    fireEvent.click(broadcastMenu);

    const input = await screen.findByPlaceholderText(/system-wide message/i, {}, { timeout: 5000 });
    fireEvent.change(input, { target: { value: 'Important Announcement' } });

    const sendBtn = screen.getByRole('button', { name: /Send Global Alert/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      // THE KEY CHECK: Verify API was called
      expect(notificationsApi.broadcast).toHaveBeenCalledWith('both', 'Important Announcement');
      expect(notification.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Alert Disseminated',
          description: expect.stringContaining('5 active sessions')
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('verifies Import actually calls the API', async () => {
    adminApi.importUsers.mockResolvedValue({ status: 'ok', imported: 10, errors: [] });

    renderWithProviders(<AdminPanel />, { authValue: { user: manager } });
    
    // Navigate to Import/Export - use findByText
    const importMenu = await screen.findByText(/Import \/ Export/i, {}, { timeout: 5000 });
    fireEvent.click(importMenu);

    // Wait for content (AntD upload button uses t('adminPanel.import.uploadButton') which is 'Upload CSV File')
    const uploadBtn = await screen.findByText(/Upload CSV File/i, {}, { timeout: 5000 });
    expect(uploadBtn).toBeInTheDocument();

    // Simulate File Upload
    const file = new File(['name,email\nTest,test@test.com'], 'users.csv', { type: 'text/csv' });
    const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement; // AntD Upload's hidden input
    expect(uploadInput).not.toBeNull();

    Object.defineProperty(uploadInput, 'files', { value: [file] });
    fireEvent.change(uploadInput);

    await waitFor(() => {
      expect(adminApi.importUsers).toHaveBeenCalled();
      expect(notification.success).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'users.csv uploaded successfully: 10 records' })
      );
    }, { timeout: 5000 });
  }, 15000);
});
