import { api } from './client';

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

export const usersApi = {
  getAll: ()                    => api.get<UserData[]>('/api/users'),
  getById: (id: string)         => api.get<UserData>(`/api/users/${id}`),
  getMe: ()                     => api.get<UserData>('/api/users/me'),

  update: (id: string, payload: UserUpdatePayload) =>
    api.patch<UserData>(`/api/users/${id}`, payload),

  delete: (id: string) =>
    api.delete<void>(`/api/users/${id}`),
};
