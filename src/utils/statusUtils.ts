import { LotStatus, RequestStatus } from '../types/enums';

// ── Lot status ─────────────────────────────────────────────────────────────

/** Hex background colours — used for lot-grid cells in LotStatusBoard. */
export const getStatusColor = (status: LotStatus): string => {
  switch (status) {
    case LotStatus.AVAILABLE:       return '#52c41a';
    case LotStatus.BLOCKED:         return '#ff4d4f';
    case LotStatus.UNOWNED:         return '#d9d9d9';
    case LotStatus.UNOWNED_BLOCKED: return '#faad14';
    default:                        return '#d9d9d9';
  }
};

export const getStatusLabel = (status: LotStatus): string => {
  switch (status) {
    case LotStatus.AVAILABLE:       return 'lotStatusBoard.legend.available';
    case LotStatus.BLOCKED:         return 'lotStatusBoard.legend.blocked';
    case LotStatus.UNOWNED:         return 'lotStatusBoard.legend.unowned';
    case LotStatus.UNOWNED_BLOCKED: return 'lotStatusBoard.legend.unownedBlocked';
    default:                        return 'status.unknown';
  }
};

/** Antd Tag colour names — used for <Tag> components in MyLots. */
export const getLotStatusTagColor = (status: LotStatus): string => {
  switch (status) {
    case LotStatus.AVAILABLE:       return 'green';
    case LotStatus.BLOCKED:         return 'red';
    case LotStatus.UNOWNED:         return 'default';
    case LotStatus.UNOWNED_BLOCKED: return 'orange';
    default:                        return 'default';
  }
};

// ── Request status ──────────────────────────────────────────────────────────

/** Antd Tag colour names for parking-request status badges. */
export const getRequestStatusColor = (status: RequestStatus | string): string => {
  switch (status) {
    case RequestStatus.APPROVED: return 'green';
    case RequestStatus.PENDING:  return 'orange';
    case RequestStatus.REJECTED: return 'red';
    case 'expired':   return 'default';
    case 'cancelled': return 'default';
    default:          return 'default';
  }
};

export const getRequestStatusLabel = (status: RequestStatus | string): string => {
  switch (status) {
    case RequestStatus.APPROVED: return 'calendarView.legend.approved';
    case RequestStatus.PENDING:  return 'calendarView.legend.pending';
    case RequestStatus.REJECTED: return 'calendarView.legend.rejected';
    case 'expired':   return 'calendarView.legend.expired'; // If we have it in i18n
    case 'cancelled': return 'calendarView.legend.cancelled'; // If we have it in i18n
    default:          return typeof status === 'string' ? status : String(status);
  }
};
