import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { AuthResponse, Organization, SessionResponse, User } from '@/types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SignupInput {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}

interface AcceptInviteInput {
  token: string;
  name: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  organization: Organization | null;
  status: AuthStatus;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  acceptInvite: (input: AcceptInviteInput) => Promise<void>;
  logout: () => Promise<void>;
  setOrganization: (organization: Organization) => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const applySession = useCallback((data: { user: User; organization: Organization }) => {
    setUser(data.user);
    setOrganization(data.organization);
    setStatus('authenticated');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<SessionResponse>('/auth/me');
      applySession(data);
    } catch {
      setUser(null);
      setOrganization(null);
      setStatus('unauthenticated');
    }
  }, [applySession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<AuthResponse>('/auth/login', { email, password });
      applySession(data);
    },
    [applySession],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const data = await api.post<AuthResponse>('/auth/signup', input);
      applySession(data);
    },
    [applySession],
  );

  const acceptInvite = useCallback(
    async (input: AcceptInviteInput) => {
      const data = await api.post<AuthResponse>('/auth/accept-invite', input);
      applySession(data);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setOrganization(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value: AuthContextValue = {
    user,
    organization,
    status,
    isAdmin: user?.role === 'ADMIN',
    refresh,
    login,
    signup,
    acceptInvite,
    logout,
    setOrganization,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
