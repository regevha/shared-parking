import { LotStatus } from '../types';

export const getStatusColor = (status: LotStatus): string => {
  switch (status) {
    case 'available':
      return '#52c41a';
    case 'blocked':
      return '#ff4d4f';
    case 'unowned':
      return '#d9d9d9';
    case 'unowned-blocked':
      return '#faad14';
    default:
      return '#d9d9d9';
  }
};

export const getStatusLabel = (status: LotStatus): string => {
  switch (status) {
    case 'available':
      return 'Available';
    case 'blocked':
      return 'Blocked';
    case 'unowned':
      return 'Unowned';
    case 'unowned-blocked':
      return 'Unowned-Blocked';
    default:
      return 'Unknown';
  }
};
