export type LotStatus = 'available' | 'blocked' | 'unowned' | 'unowned-blocked';

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

export type Role = 'User' | 'Owner' | 'Manager';
