import { api } from './client';

export interface SystemConfig {
  timezone: string;
  blackoutStart: string;
  blackoutEnd: string;
  maxActiveRequestsPerUser: number;
  bookingWindowStart: string;
  bookingWindowEnd: string;
}

function mapConfig(raw: any): SystemConfig {
  return {
    timezone:                  raw.timezone,
    blackoutStart:             raw.blackout_start,
    blackoutEnd:               raw.blackout_end,
    maxActiveRequestsPerUser:  raw.max_active_requests_per_user,
    bookingWindowStart:        raw.booking_window_start,
    bookingWindowEnd:          raw.booking_window_end,
  };
}

export const configApi = {
  get: () => api.get<any>('/api/config').then(mapConfig),
};
