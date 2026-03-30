import { api } from './client';

export interface LotData {
  id: string;
  floor: string;
  floorLabel: string;
  owner: string | null;
  ownerId: string | null;
  status: 'available' | 'blocked' | 'unowned' | 'unowned-blocked';
  blockedUntil?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LotCreatePayload {
  id: string;
  floor: string;
  floor_label: string;
  owner?: string | null;
  owner_id?: string | null;
  status?: string;
  blocked_until?: string | null;
}

export interface LotUpdatePayload {
  status?: string;
  blocked_until?: string | null;
  owner?: string | null;
  owner_id?: string | null;
}

function mapLot(l: any): LotData {
  return {
    id: l.id,
    floor: l.floor,
    floorLabel: l.floor_label,
    owner: l.owner ?? null,
    ownerId: l.owner_id ?? null,
    status: l.status,
    blockedUntil: l.blocked_until ?? undefined,
    createdAt: l.created_at ?? undefined,
    updatedAt: l.updated_at ?? undefined,
  };
}

export const lotsApi = {
  getAll:     ()                  => api.get<any[]>('/api/lots').then(ls => ls.map(mapLot)),
  /** Returns only the authenticated owner's lots (server-scoped) */
  getMine:    ()                  => api.get<any[]>('/api/lots/mine').then(ls => ls.map(mapLot)),
  getByOwner: (ownerName: string) => api.get<any[]>(`/api/lots/owner/${encodeURIComponent(ownerName)}`).then(ls => ls.map(mapLot)),
  getById:    (lotId: string)     => api.get<any>(`/api/lots/${lotId}`).then(mapLot),

  create: (payload: LotCreatePayload) =>
    api.post<any>('/api/lots', payload).then(mapLot),

  update: (lotId: string, payload: LotUpdatePayload) =>
    api.patch<any>(`/api/lots/${lotId}`, payload).then(mapLot),

  delete: (lotId: string) =>
    api.delete<void>(`/api/lots/${lotId}`),
};
