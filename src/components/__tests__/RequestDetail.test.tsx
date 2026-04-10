import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { notification } from 'antd';
import RequestDetail from '../RequestDetail';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest, makeUser, makeOwnerUser } from '../../test-utils/fixtures';
import { RequestStatus } from '../../types/enums';
import * as messagesApiModule from '../../api/messages';

jest.mock('../../api/messages');

// RequestDetail uses useParams to get the request ID — mock it for all tests
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'REQ-1' }),
}));
const mockMessagesApi = messagesApiModule.messagesApi as jest.Mocked<typeof messagesApiModule.messagesApi>;

beforeEach(() => {
  jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
  jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));
  mockMessagesApi.getForRequest.mockResolvedValue([]);
  mockMessagesApi.send.mockResolvedValue({
    id: 99, requestId: 'REQ-1', senderId: 'u-1', senderName: 'Alice',
    senderRole: 'user', text: 'Hello', sentAt: new Date().toISOString(),
  });
});
afterEach(() => { jest.restoreAllMocks(); });

const requestId = 'REQ-1';

function renderDetail(overrides = {}, userOverrides = {}) {
  const req = makeParkingRequest({ id: requestId, status: RequestStatus.PENDING, ...overrides });
  return renderWithProviders(
    <RequestDetail />,
    {
      authValue: { user: makeUser(userOverrides) },
      requestsValue: {
        pendingRequests: [req],
        approvedRequests: [],
        userRequests: [req],
      },
      route: `/request/${requestId}`,
    }
  );
}

describe('RequestDetail', () => {
  it('renders request details (requester name and time slot)', async () => {
    renderDetail({ startTime: '09:00', endTime: '10:00' });
    await waitFor(() => {
      // Requester name and time slot should always be visible
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText(/09:00/)).toBeInTheDocument();
    });
  });

  it('shows "not found" for unknown request ID', async () => {
    renderWithProviders(
      <RequestDetail />,
      {
        authValue: { user: makeUser() },
        requestsValue: { pendingRequests: [], approvedRequests: [], userRequests: [] },
        route: '/request/NONEXISTENT',
      }
    );
    await waitFor(() => {
      expect(screen.getByText(/not found|no request/i)).toBeInTheDocument();
    });
  });

  it('loads messages via messagesApi.getForRequest on mount', async () => {
    renderDetail();
    await waitFor(() => expect(mockMessagesApi.getForRequest).toHaveBeenCalledWith(requestId));
  });

  it('displays messages from API response', async () => {
    mockMessagesApi.getForRequest.mockResolvedValueOnce([{
      id: 1, requestId, senderId: 'u-2', senderName: 'Bob',
      senderRole: 'owner', text: 'We approve this.', sentAt: '2026-04-09T10:00:00Z',
    }]);
    renderDetail();
    await waitFor(() => expect(screen.getByText('We approve this.')).toBeInTheDocument());
  });

  it('sends a message and appends it to the thread', async () => {
    renderDetail();
    await waitFor(() => expect(mockMessagesApi.getForRequest).toHaveBeenCalled());

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });

    await act(async () => { fireEvent.click(sendBtn); });
    await waitFor(() => {
      expect(mockMessagesApi.send).toHaveBeenCalledWith(requestId, 'Hello');
    });
  });

  it('shows error notification when message load fails', async () => {
    mockMessagesApi.getForRequest.mockRejectedValueOnce(new Error('Network error'));
    renderDetail();
    await waitFor(() => {
      expect(notification.error).toHaveBeenCalled();
    });
  });

  it('renders the go-back button', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });
  });
});
