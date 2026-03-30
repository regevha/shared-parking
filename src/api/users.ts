import { api } from './client';
import type { NotificationWindow } from './auth';

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string; // 'user' | 'owner' | 'manager'
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  role?: string;
  password?: string;
}

export interface PreferencesData {
  darkMode: boolean;
  notificationWindows: Record<string, NotificationWindow[]>;
  // add new preference fields here
}

export interface PreferencesUpdatePayload {
  dark_mode?: boolean;
  notification_windows?: string; // JSON-serialized Record<string, NotificationWindow[]>
  // add new preference fields here (snake_case — matches backend)
}

function mapPreferences(raw: any): PreferencesData {
  let notificationWindows: Record<string, NotificationWindow[]> = {};
  if (raw?.notification_windows) {
    try { notificationWindows = JSON.parse(raw.notification_windows); } catch { /* ignore */ }
  }
  return { darkMode: raw.dark_mode ?? true, notificationWindows };
}

export const usersApi = {
  getAll: ()            => api.get<UserData[]>('/api/users'),
  getById: (id: string) => api.get<UserData>(`/api/users/${id}`),
  getMe: ()             => api.get<UserData>('/api/users/me'),

  update: (id: string, payload: UserUpdatePayload) =>
    api.patch<UserData>(`/api/users/${id}`, payload),

  delete: (id: string) =>
    api.delete<void>(`/api/users/${id}`),

  getPreferences: (id: string) =>
    api.get<any>(`/api/users/${id}/preferences`).then(mapPreferences),

  updatePreferences: (id: string, payload: PreferencesUpdatePayload) =>
    api.patch<any>(`/api/users/${id}/preferences`, payload).then(mapPreferences),
};
