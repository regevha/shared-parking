import { api } from './client';

export interface Notification {
  id: number;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  getNotifications: () => 
    api.get<Notification[]>('/api/notifications'),
    
  markAsRead: (id: number) => 
    api.patch<Notification>(`/api/notifications/${id}/read`),
    
  markAllRead: () => 
    api.post<{ status: string }>('/api/notifications/read-all', {}),
    
  broadcast: (audience: 'both' | 'users' | 'owners', message: string) =>
    api.post<{ status: string, delivered_to: number }>('/api/notifications/broadcast', { audience, message }),
};
