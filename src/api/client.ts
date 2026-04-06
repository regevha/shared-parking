// Use the same hostname the browser used to load the app, but on port 8000.
// This makes LAN/mobile access work automatically (e.g. http://192.168.1.x:8000).
// Override with REACT_APP_API_URL env var if needed.
const BASE_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;
const TOKEN_KEY = 'parking_token';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const headers: Record<string, string> = {
    ...authHeader,
    ...(options?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown, options?: RequestInit) => {
    const isFormData = body instanceof FormData;
    return request<T>(path, {
      method: 'POST',
      ...options,
      body: isFormData ? body : JSON.stringify(body),
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options?.headers as Record<string, string>),
      }
    });
  },
  patch: <T>(path: string, body?: unknown, options?: RequestInit) => request<T>(path, { 
    method: 'PATCH', 
    ...options,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers as Record<string, string>,
    }
  }),
  delete: <T>(path: string, options?: RequestInit) => request<T>(path, { 
    method: 'DELETE',
    ...options,
  }),
};
