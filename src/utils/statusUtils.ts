import { LotStatus } from '../types';

// ── Lot status ─────────────────────────────────────────────────────────────

/** Hex background colours — used for lot-grid cells in LotStatusBoard. */
export const getStatusColor = (status: LotStatus): string => {
  switch (status) {
    case 'available':       return '#52c41a';
    case 'blocked':         return '#ff4d4f';
    case 'unowned':         return '#d9d9d9';
    case 'unowned-blocked': return '#faad14';
    default:                return '#d9d9d9';
  }
};

export const getStatusLabel = (status: LotStatus): string => {
  switch (status) {
    case 'available':       return 'Available';
    case 'blocked':         return 'Blocked';
    case 'unowned':         return 'Unowned';
    case 'unowned-blocked': return 'Unowned-Blocked';
    default:                return 'Unknown';
  }
};

/** Antd Tag colour names — used for <Tag> components in MyLots. */
export const getLotStatusTagColor = (status: LotStatus): string => {
  switch (status) {
    case 'available':       return 'green';
    case 'blocked':         return 'red';
    case 'unowned':         return 'default';
    case 'unowned-blocked': return 'orange';
    default:                return 'default';
  }
};

// ── Request status ──────────────────────────────────────────────────────────

/** Antd Tag colour names for parking-request status badges. */
export const getRequestStatusColor = (status: string): string => {
  switch (status) {
    case 'approved':  return 'green';
    case 'pending':   return 'blue';
    case 'rejected':  return 'red';
    case 'expired':   return 'orange';
    case 'cancelled': return 'default';
    default:          return 'default';
  }
};

export const getRequestStatusLabel = (status: string): string => {
  switch (status) {
    case 'approved':  return 'Approved';
    case 'pending':   return 'Pending';
    case 'rejected':  return 'Rejected';
    case 'expired':   return 'Expired';
    case 'cancelled': return 'Cancelled';
    default:          return status;
  }
};
