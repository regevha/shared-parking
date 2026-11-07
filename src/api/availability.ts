import { api } from './client';

export interface AvailabilityWindowData {
  id: number;
  lotId: string;
  dayOfWeek: number | null;   // 0=Mon … 6=Sun; null when specific_date is set
  specificDate: string | null; // "YYYY-MM-DD"; null when day_of_week is set
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string | null;
}

export interface AvailabilityWindowCreate {
  day_of_week?: number;
  specific_date?: string;
  start_time: string;
  end_time: string;
}

export interface AvailabilityWindowUpdate {
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
}

interface ApiWindow {
  id: number;
  lot_id: string;
  day_of_week?: number | null;
  specific_date?: string | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at?: string | null;
}

function mapWindow(raw: ApiWindow): AvailabilityWindowData {
  return {
    id: raw.id,
    lotId: raw.lot_id,
    dayOfWeek: raw.day_of_week ?? null,
    specificDate: raw.specific_date ?? null,
    startTime: raw.start_time,
    endTime: raw.end_time,
    isActive: raw.is_active,
    createdAt: raw.created_at ?? null,
  };
}

export const availabilityApi = {
  list: (lotId: string) =>
    api.get<ApiWindow[]>(`/api/lots/${lotId}/availability`).then(ws => ws.map(mapWindow)),

  create: (lotId: string, payload: AvailabilityWindowCreate) =>
    api.post<ApiWindow>(`/api/lots/${lotId}/availability`, payload).then(mapWindow),

  update: (lotId: string, windowId: number, payload: AvailabilityWindowUpdate) =>
    api.patch<ApiWindow>(`/api/lots/${lotId}/availability/${windowId}`, payload).then(mapWindow),

  delete: (lotId: string, windowId: number) =>
    api.delete<void>(`/api/lots/${lotId}/availability/${windowId}`),
};

export const DAY_LABELS: Record<number, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
};
