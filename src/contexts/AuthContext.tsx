import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser } from '../api/auth';

const TOKEN_KEY = 'parking_token';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [authLoading, setAuthLoading] = useState(true);

  // On mount, re-validate the stored token
  useEffect(() => {
    if (token) {
      authApi.me()
        .then(u => setUser(u))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    const resp = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, resp.access_token);
    setToken(resp.access_token);
    setUser({ id: resp.id, name: resp.name, email: resp.email, role: resp.role, preferences: resp.preferences });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const updateUser = (patch: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...patch } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, token, authLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
