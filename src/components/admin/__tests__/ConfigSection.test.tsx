import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notification } from 'antd';
import ConfigSection from '../ConfigSection';
import { configApi } from '../../../api/config';

jest.mock('../../../api/config', () => ({ configApi: { get: jest.fn(), triggerAutoApproval: jest.fn() } }));
const api = configApi as jest.Mocked<typeof configApi>;

const CONFIG = {
  timezone: 'Asia/Jerusalem', blackoutStart: '22:00', blackoutEnd: '06:00',
  maxPendingRequestsPerUser: 5, bookingWindowStart: '00:00', bookingWindowEnd: '23:59',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(notification, 'success').mockImplementation(() => {});
  jest.spyOn(notification, 'error').mockImplementation(() => {});
});

describe('ConfigSection', () => {
  it('loads and shows the server configuration', async () => {
    api.get.mockResolvedValue(CONFIG);
    render(<ConfigSection />);
    expect(await screen.findByText('Asia/Jerusalem')).toBeInTheDocument();
    expect(screen.getByText('22:00 – 06:00')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('falls back to dashes when the config cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('down'));
    render(<ConfigSection />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect((await screen.findAllByText('—')).length).toBeGreaterThanOrEqual(3);
  });

  it('runs auto-approval on demand and reports the result', async () => {
    api.get.mockResolvedValue(CONFIG);
    api.triggerAutoApproval.mockResolvedValue({ approved: 2, remainingPending: 1 });
    render(<ConfigSection />);
    await screen.findByText('Asia/Jerusalem');
    fireEvent.click(screen.getByRole('button', { name: /run auto/i }));
    await waitFor(() => expect(api.triggerAutoApproval).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(notification.success).toHaveBeenCalled());
  });

  it('reports a failed auto-approval run', async () => {
    api.get.mockResolvedValue(CONFIG);
    api.triggerAutoApproval.mockRejectedValue(new Error('boom'));
    render(<ConfigSection />);
    await screen.findByText('Asia/Jerusalem');
    fireEvent.click(screen.getByRole('button', { name: /run auto/i }));
    await waitFor(() => expect(notification.error).toHaveBeenCalled());
    expect(notification.success).not.toHaveBeenCalled();
  });
});
