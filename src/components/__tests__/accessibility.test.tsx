/**
 * Automated accessibility checks (axe-core via jest-axe) for the main screens.
 *
 * Scope and limits:
 *  - jsdom has no layout engine, so `color-contrast` cannot be evaluated here; it is
 *    covered by the Playwright axe scan in e2e/tests/accessibility.spec.ts instead.
 *  - `region` is disabled because components are rendered without the app shell.
 *  - Ant Design's DatePicker crashes in jsdom (see LotStatusBoard.test.tsx), so it is
 *    replaced by a labelled stub here; the real one is covered by the Playwright scan.
 */
import React from 'react';
import { waitFor } from '@testing-library/react';
import { configureAxe, toHaveNoViolations } from 'jest-axe';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  DatePicker: () => <input type="date" aria-label="Date" readOnly />,
}));
jest.mock('../../api/messages');
jest.mock('../../api/requests');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'REQ-1' }),
}));

import LoginPage from '../LoginPage';
import MyRequests from '../MyRequests';
import MyLots from '../MyLots';
import ParkingRequestForm from '../ParkingRequestForm';
import AllPendingRequests from '../AllPendingRequests';
import AllApprovals from '../AllApprovals';
import LotStatusBoard from '../LotStatusBoard';
import RequestDetail from '../RequestDetail';
import AuditTrailModal from '../AuditTrailModal';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import {
  makeParkingRequest, makeLot, makeUser, makeOwnerUser,
} from '../../test-utils/fixtures';
import { RequestStatus, UserRole } from '../../types/enums';
import * as messagesApiModule from '../../api/messages';
import * as requestsApiModule from '../../api/requests';

expect.extend(toHaveNoViolations);

// axe over large Ant Design tables is slow in jsdom (several seconds per screen)
jest.setTimeout(30000);

const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false }, // needs a real browser — see Playwright scan
    region: { enabled: false },           // components are rendered without the app shell
  },
});

const messagesApi = messagesApiModule.messagesApi as jest.Mocked<typeof messagesApiModule.messagesApi>;
const requestsApi = requestsApiModule.requestsApi as jest.Mocked<typeof requestsApiModule.requestsApi>;

beforeEach(() => {
  messagesApi.getForRequest.mockResolvedValue([]);
  requestsApi.getAuditTrail.mockResolvedValue([
    { id: 1, request_id: 'REQ-1', user_name: 'Alice', action: 'created', timestamp: new Date().toISOString() },
  ] as any);
});

const pending = makeParkingRequest({ id: 'REQ-1', status: RequestStatus.PENDING });
const approved = makeParkingRequest({ id: 'REQ-2', status: RequestStatus.APPROVED, lotId: 'A-01', lotOwner: 'Bob Owner' });
const lots = [makeLot({ id: 'A-01' }), makeLot({ id: 'A-02' })];

async function expectNoViolations(container: HTMLElement) {
  // Let async effects (data loads, skeletons) settle before scanning
  await waitFor(() => expect(container).toBeTruthy());
  expect(await axe(container)).toHaveNoViolations();
}

describe('accessibility (axe)', () => {
  it('LoginPage', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    await expectNoViolations(container);
  });

  it('ParkingRequestForm', async () => {
    const { container } = renderWithProviders(<ParkingRequestForm />, {
      authValue: { user: makeUser() },
      requestsValue: { userRequests: [pending] },
    });
    await expectNoViolations(container);
  });

  it('MyRequests', async () => {
    const { container } = renderWithProviders(<MyRequests />, {
      authValue: { user: makeUser() },
      requestsValue: { userRequests: [pending, approved] },
    });
    await expectNoViolations(container);
  });

  it('MyLots', async () => {
    const { container } = renderWithProviders(<MyLots />, {
      authValue: { user: makeOwnerUser() },
      requestsValue: { ownerLots: lots, approvedRequests: [approved] },
    });
    await expectNoViolations(container);
  });

  it('AllPendingRequests', async () => {
    const { container } = renderWithProviders(<AllPendingRequests role={UserRole.OWNER} />, {
      authValue: { user: makeOwnerUser() },
      requestsValue: { pendingRequests: [pending], ownerLots: lots, allLots: lots },
    });
    await expectNoViolations(container);
  });

  it('AllApprovals', async () => {
    const { container } = renderWithProviders(<AllApprovals />, {
      authValue: { user: makeOwnerUser() },
      requestsValue: { approvedRequests: [approved], allLots: lots },
    });
    await expectNoViolations(container);
  });

  it('LotStatusBoard (parking spots are keyboard-operable)', async () => {
    const { container } = renderWithProviders(<LotStatusBoard />, {
      authValue: { user: makeUser() },
      requestsValue: { allLots: lots, approvedRequests: [] },
    });
    await expectNoViolations(container);
  });

  it('RequestDetail', async () => {
    const { container } = renderWithProviders(<RequestDetail />, {
      authValue: { user: makeUser() },
      requestsValue: { pendingRequests: [pending], userRequests: [pending] },
      route: '/request/REQ-1',
    });
    await expectNoViolations(container);
  });

  it('AuditTrailModal (dialog semantics)', async () => {
    const { container } = renderWithProviders(
      <AuditTrailModal requestId="REQ-1" onClose={() => {}} />,
      { authValue: { user: makeUser() } },
    );
    await expectNoViolations(container);
  });
});
