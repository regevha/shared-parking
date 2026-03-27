const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function mapPreferences(raw: any): { darkMode: boolean } {
  return { darkMode: raw?.dark_mode ?? true };
}

export interface UserPreferences {
  darkMode: boolean;
  // add new preference fields here
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string; // 'user' | 'owner' | 'manager'
  preferences: UserPreferences;
}

export interface TokenResponse extends AuthUser {
  access_token: string;
  token_type: string;
}

export const authApi = {
  /** Login uses form encoding (OAuth2PasswordRequestForm) — NOT JSON */
  login: async (email: string, password: string): Promise<TokenResponse> => {
    const form = new URLSearchParams();
    form.set('username', email);
    form.set('password', password);
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Login failed');
    }
    const data = await res.json();
    return { ...data, id: data.user_id, preferences: mapPreferences(data.preferences) };
  },

  /** Validate stored token and return current user */
  me: async (): Promise<AuthUser> => {
    const token = localStorage.getItem('parking_token');
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Token invalid');
    const data = await res.json();
    return { ...data, preferences: mapPreferences(data.preferences) };
  },
};
