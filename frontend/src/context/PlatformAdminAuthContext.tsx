import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';

type PlatformAdminStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface PlatformAdminSession {
  id: string;
  email: string;
  name: string;
}

interface PlatformAdminAuthContextValue {
  admin: PlatformAdminSession | null;
  status: PlatformAdminStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PlatformAdminAuthContext = createContext<PlatformAdminAuthContextValue | undefined>(undefined);

/**
 * Entirely separate from the tenant AuthContext — different cookie, different
 * JWT scope, different backend surface (/api/platform-admin). Deliberately
 * does not share any state or storage with the tenant session, so a browser
 * can be logged into both a client organization AND the owner panel at once
 * without either leaking into the other.
 */
export function PlatformAdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdminSession | null>(null);
  const [status, setStatus] = useState<PlatformAdminStatus>('loading');

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ admin: PlatformAdminSession }>('/platform-admin/me');
      setAdmin(data.admin);
      setStatus('authenticated');
    } catch {
      setAdmin(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ admin: PlatformAdminSession }>('/platform-admin/login', { email, password });
    setAdmin(data.admin);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await api.post('/platform-admin/logout');
    setAdmin(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <PlatformAdminAuthContext.Provider value={{ admin, status, login, logout }}>
      {children}
    </PlatformAdminAuthContext.Provider>
  );
}

export function usePlatformAdminAuth(): PlatformAdminAuthContextValue {
  const ctx = useContext(PlatformAdminAuthContext);
  if (!ctx) throw new Error('usePlatformAdminAuth must be used within PlatformAdminAuthProvider');
  return ctx;
}
