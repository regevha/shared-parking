import React from 'react';
import { screen } from '@testing-library/react';
import { notification } from 'antd';
import ParkingRequestForm from '../ParkingRequestForm';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { makeParkingRequest, makeUser } from '../../test-utils/fixtures';

// Silence antd notification portals in jsdom
import { RequestStatus } from '../../types/enums';

jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));

const alice = makeUser();

// Must match MAX_PENDING_REQUESTS in ParkingRequestForm.tsx (and .env.example)
const MAX_ACTIVE = 10;

function makeActiveRequests(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeParkingRequest({ status: i % 2 === 0 ? RequestStatus.PENDING : RequestStatus.APPROVED }));
}

describe('ParkingRequestForm — max-requests gate', () => {
  it('shows "Submit Request" button text with 0 active requests', () => {
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: [] },
    });
    expect(screen.getByRole('button', { name: /Submit Request/i })).toBeInTheDocument();
  });

  it('shows "Submit Request" with 2 active (below limit)', () => {
    const active = [
      makeParkingRequest({ status: RequestStatus.PENDING }),
      makeParkingRequest({ status: RequestStatus.APPROVED }),
    ];
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: active },
    });
    expect(screen.getByRole('button', { name: /Submit Request/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows "Cannot Submit" button text at limit (10 active)', () => {
    const active = makeActiveRequests(MAX_ACTIVE);
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: active },
    });
    expect(screen.getByRole('button', { name: /Cannot Submit/i })).toBeInTheDocument();
  });

  it('shows warning Alert at limit', () => {
    const active = makeActiveRequests(MAX_ACTIVE);
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: active },
    });
    expect(screen.getByText('Request Limit Reached')).toBeInTheDocument(); // antd Alert title
  });

  it('does not show warning Alert below limit', () => {
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: [] },
    });
    expect(screen.queryByText('Request Limit Reached')).not.toBeInTheDocument();
  });

  it('rejected requests do not count toward the active limit', () => {
    // 4 active + 1 rejected = still under the 10-active limit
    const requests = [
      makeParkingRequest({ status: RequestStatus.PENDING }),
      makeParkingRequest({ status: RequestStatus.APPROVED }),
      makeParkingRequest({ status: RequestStatus.PENDING }),
      makeParkingRequest({ status: RequestStatus.PENDING }),
      makeParkingRequest({ status: RequestStatus.REJECTED }),
    ];
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: requests },
    });
    expect(screen.getByRole('button', { name: /Submit Request/i })).toBeInTheDocument();
    expect(screen.queryByText('Request Limit Reached')).not.toBeInTheDocument();
  });
});

describe('ParkingRequestForm — active requests card', () => {
  it('shows active requests card with count when there are active requests', () => {
    const active = [
      makeParkingRequest({ status: RequestStatus.PENDING }),
      makeParkingRequest({ status: RequestStatus.APPROVED }),
    ];
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: active },
    });
    expect(screen.getByText(/Your Pending Requests \(2 \/ 10\)/i)).toBeInTheDocument();
  });

  it('does not show active requests card with 0 active requests', () => {
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: [] },
    });
    expect(screen.queryByText(/Your Pending Requests/i)).not.toBeInTheDocument();
  });

  it('shows request time slot details in the active requests card', () => {
    const req = makeParkingRequest({ startTime: '10:00', endTime: '12:00', status: RequestStatus.PENDING });
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: [req] },
    });
    expect(screen.getByText('10:00 – 12:00')).toBeInTheDocument();
  });
});

describe('ParkingRequestForm — info banner', () => {
  it('renders the info banner at the bottom of the page', () => {
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: [] },
    });
    expect(screen.getByText(/Submit Parking Request:/i)).toBeInTheDocument();
  });
});


describe('ParkingRequestForm — guidance text', () => {
  it('shows an accurate inline helper instead of the old Business Rules card', () => {
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: [] },
    });
    expect(screen.getByText(/1–36 hours/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`up to ${MAX_ACTIVE} active requests`))).toBeInTheDocument();
    expect(screen.queryByText(/Business Rules/i)).not.toBeInTheDocument();
  });

  it('does not show the availability warning before a slot is chosen', () => {
    renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: alice },
      requestsValue: { userRequests: [] },
    });
    expect(screen.queryByText(/No lot looks free/i)).not.toBeInTheDocument();
  });
});
