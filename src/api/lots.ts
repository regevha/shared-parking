import { api } from './client';

export interface LotData {
  id: string;
  floor: string;
  floorLabel: string;
  owner: string | null;
  status: 'available' | 'blocked' | 'unowned' | 'unowned-blocked';
  blockedUntil?: string;
}

function mapLot(l: any): LotData {
  return {
    id: l.id,
    floor: l.floor,
    floorLabel: l.floor_label,
    owner: l.owner ?? null,
    status: l.status,
    blockedUntil: l.blocked_until ?? undefined,
  };
}

export const lotsApi = {
  getAll:     ()                  => api.get<any[]>('/api/lots').then(ls => ls.map(mapLot)),
  /** Returns only the authenticated owner's lots (server-scoped) */
  getMine:    ()                  => api.get<any[]>('/api/lots/mine').then(ls => ls.map(mapLot)),
  getByOwner: (ownerName: string) => api.get<any[]>(`/api/lots/owner/${encodeURIComponent(ownerName)}`).then(ls => ls.map(mapLot)),
  getById:    (lotId: string)     => api.get<any>(`/api/lots/${lotId}`).then(mapLot),
};
