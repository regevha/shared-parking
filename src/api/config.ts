import { api } from './client';

export interface SystemConfig {
  timezone: string;
  blackoutStart: string;
  blackoutEnd: string;
  maxPendingRequestsPerUser: number;
  bookingWindowStart: string;
  bookingWindowEnd: string;
}

interface ApiConfig {
  timezone: string;
  blackout_start: string;
  blackout_end: string;
  max_pending_requests_per_user: number;
  booking_window_start: string;
  booking_window_end: string;
}

interface ApiAutoApprovalResult {
  approved: number;
  remaining_pending: number;
}

function mapConfig(raw: ApiConfig): SystemConfig {
  return {
    timezone:                  raw.timezone,
    blackoutStart:             raw.blackout_start,
    blackoutEnd:               raw.blackout_end,
    maxPendingRequestsPerUser:  raw.max_pending_requests_per_user,
    bookingWindowStart:        raw.booking_window_start,
    bookingWindowEnd:          raw.booking_window_end,
  };
}

export interface AutoApprovalResult {
  approved: number;
  remainingPending: number;
}

export const configApi = {
  get: () => api.get<ApiConfig>('/api/config').then(mapConfig),
  triggerAutoApproval: () =>
    api.post<ApiAutoApprovalResult>('/api/config/run-auto-approval', {}).then((raw) => ({
      approved: raw.approved,
      remainingPending: raw.remaining_pending,
    } as AutoApprovalResult)),
};
