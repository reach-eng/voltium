'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AdminSession {
  id: string;
  email: string;
  name: string;
  role: string;
  adminRole?: string;
  adminId?: string;
  isActive: boolean;
  permissions: string[];
  adminPermissions: string[];
}

interface AdminSessionContextValue {
  session: AdminSession | null;
  isLoading: boolean;
  isAuthorized: boolean | null;
  refetch: () => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionContextValue>({
  session: null,
  isLoading: true,
  isAuthorized: null,
  refetch: async () => {},
});

export function useAdminSession() {
  return useContext(AdminSessionContext);
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.data?.role) {
          setSession(data.data);
          return;
        }
      }
      setSession(null);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const isAuthorized = isLoading ? null : session !== null;

  return (
    <AdminSessionContext.Provider
      value={{ session, isLoading, isAuthorized, refetch: fetchSession }}
    >
      {children}
    </AdminSessionContext.Provider>
  );
}
