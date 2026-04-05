import { UserRole, LotStatus, RequestStatus } from './enums';

export { UserRole, LotStatus, RequestStatus };

export interface Lot {
  id: string;
  floor: string;
  owner: string | null;
  status: LotStatus;
  blockedUntil?: string;
}

export interface FloorData {
  floor: string;
  lots: Lot[];
}

export type Role = UserRole;
