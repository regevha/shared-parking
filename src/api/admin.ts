import { api } from './client';

export const adminApi = {
  importUsers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ status: string, imported: number, errors: string[] }>('/api/admin/import-users', formData);
  },
  importLots: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ status: string, imported: number, errors: string[] }>('/api/admin/import-lots', formData);
  }
};
