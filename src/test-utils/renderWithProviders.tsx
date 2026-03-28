import React, { ReactElement } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthContext } from '../contexts/AuthContext';
import { RequestsContext } from '../contexts/RequestsContext';
import { AuthUser } from '../api/auth';
import { ParkingRequest } from '../contexts/RequestsContext';
import { LotData } from '../api/lots';

// ── Default no-op context values ─────────────────────────────────────────────

export const defaultAuthValue = {
  user: null as AuthUser | null,
  token: null as string | null,
  authLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateUser: jest.fn(),
};

export const defaultRequestsValue = {
  pendingRequests: [] as ParkingRequest[],
  approvedRequests: [] as ParkingRequest[],
  userRequests: [] as ParkingRequest[],
  allLots: [] as LotData[],
  ownerLots: [] as LotData[],
  loading: false,
  error: null,
  addPendingRequest: jest.fn(),
  approveRequest: jest.fn(),
  rejectRequest: jest.fn(),
  cancelUserRequest: jest.fn(),
  updateUserRequest: jest.fn(),
};

interface RenderOptions {
  authValue?: Partial<typeof defaultAuthValue>;
  requestsValue?: Partial<typeof defaultRequestsValue>;
  route?: string;
}

/**
 * Renders a component inside MemoryRouter + ConfigProvider + both contexts.
 * Pass partial overrides for `authValue` and `requestsValue` to set up state.
 */
export function renderWithProviders(
  ui: ReactElement,
  { authValue = {}, requestsValue = {}, route = '/' }: RenderOptions = {}
): RenderResult {
  const auth = { ...defaultAuthValue, ...authValue };
  const requests = { ...defaultRequestsValue, ...requestsValue };

  return render(
    <MemoryRouter initialEntries={[route]}>
      <ConfigProvider>
        <AuthContext.Provider value={auth}>
          <RequestsContext.Provider value={requests}>
            {ui}
          </RequestsContext.Provider>
        </AuthContext.Provider>
      </ConfigProvider>
    </MemoryRouter>
  );
}
