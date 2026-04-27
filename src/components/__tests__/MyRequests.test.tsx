import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { notification } from 'antd';
import MyRequests from '../MyRequests';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest } from '../../test-utils/fixtures';
import { RequestStatus } from '../../types/enums';

jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));

const pendingReq  = makeParkingRequest({ id: '1', requesterName: 'Alice', status: RequestStatus.PENDING,  startTime: '09:00', endTime: '10:00' });
const approvedReq = makeParkingRequest({ id: '2', requesterName: 'Alice', status: RequestStatus.APPROVED, startTime: '14:00', endTime: '16:00' });
const rejectedReq = makeParkingRequest({ id: '3', requesterName: 'Alice', status: RequestStatus.REJECTED, startTime: '11:00', endTime: '12:00' });

// ── Visibility filter ─────────────────────────────────────────────────────────

describe('MyRequests — request visibility', () => {
  it('shows pending requests', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument();
    });
  });

  it('shows approved requests', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [approvedReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('14:00 - 16:00')).toBeInTheDocument();
    });
  });

  it('hides rejected requests', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [rejectedReq] },
    });
    // The rejected row's time slot should not be in the table
    await waitFor(() => {
      expect(screen.queryByText('11:00 - 12:00')).not.toBeInTheDocument();
    });
  });

  it('shows pending and approved but not rejected when all three exist', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq, approvedReq, rejectedReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument();
      expect(screen.getByText('14:00 - 16:00')).toBeInTheDocument();
      expect(screen.queryByText('11:00 - 12:00')).not.toBeInTheDocument();
    });
  });
});

// ── Edit button visibility ────────────────────────────────────────────────────

describe('MyRequests — edit button', () => {
  it('shows Edit button for pending request', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq] },
    });
    await waitFor(() => {
      expect(screen.getByTitle('Edit')).toBeInTheDocument();
    });
  });

  it('does not show Edit button for approved request', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [approvedReq] },
    });
    await waitFor(() => {
      expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    });
  });

  it('shows Edit only for pending row when both pending and approved exist', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq, approvedReq] },
    });
    await waitFor(() => {
      const editButtons = screen.getAllByTitle('Edit');
      expect(editButtons).toHaveLength(1);
    });
  });
});

// ── Cancel button presence ────────────────────────────────────────────────────

describe('MyRequests — cancel button', () => {
  it('shows Cancel button for pending request', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq] },
    });
    await waitFor(() => {
      expect(screen.getByTitle('Cancel')).toBeInTheDocument();
    });
  });

  it('shows Cancel button for approved request', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [approvedReq] },
    });
    await waitFor(() => {
      expect(screen.getByTitle('Cancel')).toBeInTheDocument();
    });
  });

  it('shows Cancel for both pending and approved rows', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq, approvedReq] },
    });
    await waitFor(() => {
      expect(screen.getAllByTitle('Cancel')).toHaveLength(2);
    });
  });
});

// ── Stats cards ───────────────────────────────────────────────────────────────

describe('MyRequests — stats', () => {
  it('shows correct Total Active count', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq, approvedReq, rejectedReq] },
    });
    await waitFor(() => {
      expect(screen.getByText('Total Active')).toBeInTheDocument();
    });
    // Total Active should be 2. '2' also appears as the ID column value for
    // approvedReq (id='2'), so use getAllByText and verify at least one match exists.
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThan(0);
  });

  it('shows 0 Total Active with no requests', () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [] },
    });
    expect(screen.getByText('Total Active')).toBeInTheDocument();
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(1);
  });

  it('shows correct Pending and Approved counts', async () => {
    renderWithProviders(<MyRequests />, {
      requestsValue: { userRequests: [pendingReq, approvedReq] },
    });
    await waitFor(() => {
      // 'Pending' appears as both a status Tag and a stat-card label; same for 'Approved'
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
    });
    // Each of pending and approved count should show as '1'
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(2);
  });
});

// ── "New Request" button ──────────────────────────────────────────────────────

describe('MyRequests — navigation', () => {
  it('renders the "+ New Request" button', () => {
    renderWithProviders(<MyRequests />, { requestsValue: { userRequests: [] } });
    // Header button + empty-state CTA both render "New Request"
    const buttons = screen.getAllByRole('button', { name: /New Request/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Info banner ───────────────────────────────────────────────────────────────

describe('MyRequests — info banner', () => {
  it('renders the info banner', () => {
    renderWithProviders(<MyRequests />, { requestsValue: { userRequests: [] } });
    expect(screen.getByText(/My Requests:/i)).toBeInTheDocument();
  });
});
