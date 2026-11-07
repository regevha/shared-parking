import { api } from './client';
import { LotStatus } from '../types/enums';

export interface LotData {
  id: string;
  floor: string;
  floorLabel: string;
  owner: string | null;
  ownerId: string | null;
  status: LotStatus;
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

interface ApiLot {
  id: string;
  floor: string;
  floor_label: string;
  owner?: string | null;
  owner_id?: string | null;
  status: LotStatus;
  blocked_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapLot(l: ApiLot): LotData {
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
  getAll:     ()                  => api.get<ApiLot[]>('/api/lots').then(ls => ls.map(mapLot)),
  /** Returns only the authenticated owner's lots (server-scoped) */
  getMine:    ()                  => api.get<ApiLot[]>('/api/lots/mine').then(ls => ls.map(mapLot)),
  getByOwner: (ownerName: string) => api.get<ApiLot[]>(`/api/lots/owner/${encodeURIComponent(ownerName)}`).then(ls => ls.map(mapLot)),
  getById:    (lotId: string)     => api.get<ApiLot>(`/api/lots/${lotId}`).then(mapLot),

  create: (payload: LotCreatePayload) =>
    api.post<ApiLot>('/api/lots', payload).then(mapLot),

  update: (lotId: string, payload: LotUpdatePayload) =>
    api.patch<ApiLot>(`/api/lots/${lotId}`, payload).then(mapLot),

  delete: (lotId: string) =>
    api.delete<void>(`/api/lots/${lotId}`),
};
