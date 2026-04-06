import { api } from './client';
import { ParkingRequest } from '../contexts/RequestsContext';

export interface CreateRequestPayload {
  requester_id: string;
  requester_name: string;
  date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  duration: number;
}

export interface UpdateRequestPayload {
  date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  duration?: number;
}

export interface ApprovePayload {
  lot_id?: string;
  floor?: string;
  lot_owner?: string;
}

// Map snake_case API response → camelCase ParkingRequest
function mapRequest(r: any): ParkingRequest {
  return {
    id: r.id,
    requesterId: r.requester_id,
    requesterName: r.requester_name,
    requesterRole: r.requester_role,
    date: r.date,
    startTime: r.start_time,
    endDate: r.end_date,
    endTime: r.end_time,
    duration: r.duration,
    submittedAt: r.submitted_at,
    status: r.status,
    rejectedByOwner: r.rejected_by_owner ?? false,
    lotId: r.lot_id ?? undefined,
    floor: r.floor ?? undefined,
    lotOwner: r.lot_owner ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    approvedBy: r.approved_by ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  };
}

export const requestsApi = {
  getAll:     ()              => api.get<any[]>('/api/requests').then(rs => rs.map(mapRequest)),
  getPending: ()              => api.get<any[]>('/api/requests/pending').then(rs => rs.map(mapRequest)),
  getApproved:()              => api.get<any[]>('/api/requests/approved').then(rs => rs.map(mapRequest)),
  /** Returns only the authenticated user's requests (server-scoped) */
  getMe:      ()              => api.get<any[]>('/api/requests/me').then(rs => rs.map(mapRequest)),

  create: (payload: CreateRequestPayload) =>
    api.post<any>('/api/requests', payload).then(mapRequest),

  approve: (id: string, lotInfo?: ApprovePayload) =>
    api.patch<any>(`/api/requests/${id}/approve`, {
      lot_id:    lotInfo?.lot_id,
      floor:     lotInfo?.floor,
      lot_owner: lotInfo?.lot_owner,
    }).then(mapRequest),

  reject: (id: string) =>
    api.patch<any>(`/api/requests/${id}/reject`).then(mapRequest),

  update: (id: string, payload: UpdateRequestPayload) =>
    api.patch<any>(`/api/requests/${id}`, {
      date:       payload.date,
      start_time: payload.start_time,
      end_date:   payload.end_date,
      end_time:   payload.end_time,
      duration:   payload.duration,
    }).then(mapRequest),

  cancel: (id: string) =>
    api.delete<void>(`/api/requests/${id}`),

  runAutoApprove: () =>
    api.post<any>('/api/requests/run-auto-approve', {}),

  getAuditTrail: (id: string) =>
    api.get<any[]>(`/api/requests/${id}/audit`),
};
