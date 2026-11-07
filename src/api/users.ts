import { api } from './client';
import type { AvailabilityWindow, NotificationWindow } from './auth';

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string; // 'user' | 'owner' | 'manager'
  createdAt?: string; // ISO string
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string | null;
}

interface ApiPreferences {
  dark_mode?: boolean | null;
  availability_windows?: string | null;
  notification_windows?: string | null;
  language?: string | null;
}

function mapUser(u: ApiUser): UserData {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at ?? undefined };
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  role?: string;
  password?: string;
}

export interface PreferencesData {
  darkMode: boolean;
  availabilityWindows: Record<string, AvailabilityWindow[]>;
  notificationWindows: Record<string, NotificationWindow[]>;
  language: string;
  // add new preference fields here
}

export interface PreferencesUpdatePayload {
  dark_mode?: boolean;
  availability_windows?: string; // JSON
  notification_windows?: string; // JSON
  language?: string;
}

function mapPreferences(raw: ApiPreferences): PreferencesData {
  let availabilityWindows: Record<string, AvailabilityWindow[]> = {};
  if (raw?.availability_windows) {
    try { availabilityWindows = JSON.parse(raw.availability_windows); } catch { /* ignore */ }
  }
  let notificationWindows: Record<string, NotificationWindow[]> = {};
  if (raw?.notification_windows) {
    try { notificationWindows = JSON.parse(raw.notification_windows); } catch { /* ignore */ }
  }
  return {
    darkMode: raw.dark_mode ?? true,
    availabilityWindows,
    notificationWindows,
    language: raw?.language ?? 'en'
  };
}

export const usersApi = {
  getAll: ()            => api.get<ApiUser[]>('/api/users').then(us => us.map(mapUser)),
  getById: (id: string) => api.get<ApiUser>(`/api/users/${id}`).then(mapUser),
  getMe: ()             => api.get<ApiUser>('/api/users/me').then(mapUser),

  update: (id: string, payload: UserUpdatePayload) =>
    api.patch<ApiUser>(`/api/users/${id}`, payload).then(mapUser),

  delete: (id: string) =>
    api.delete<void>(`/api/users/${id}`),

  getPreferences: (id: string) =>
    api.get<ApiPreferences>(`/api/users/${id}/preferences`).then(mapPreferences),

  updatePreferences: (id: string, payload: PreferencesUpdatePayload) =>
    api.patch<ApiPreferences>(`/api/users/${id}/preferences`, payload).then(mapPreferences),
};
