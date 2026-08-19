import { useState, useEffect, useCallback } from 'react';

export interface OperationsStats {
  activeRentals: number;
  pendingKyc: number;
  pendingDeposits: number;
  availableVehicles: number;
  openTickets: number;
}

export interface UseOperationsOptions {
  realtime?: boolean;
}

export interface UseOperationsReturn {
  stats: OperationsStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOperations(options?: UseOperationsOptions): UseOperationsReturn {
  const [stats, setStats] = useState<OperationsStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const realtime = options?.realtime;

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const url = realtime
        ? '/api/admin/operations/overview?realtime=true'
        : '/api/admin/operations/overview';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch operations overview');
      }
      setStats(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch operations overview');
    } finally {
      setLoading(false);
    }
  }, [realtime]);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => {
      fetchOverview();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  return {
    stats,
    loading,
    error,
    refresh: fetchOverview,
  };
}
