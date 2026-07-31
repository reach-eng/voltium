'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  DASHBOARD_POLL_INTERVAL_MS,
  type AuditLogEntry,
  type DashboardStats,
  type RecentTicket,
  type RecentTransaction,
} from './types';

/**
 * R3.7z split — Dashboard data hook.
 *
 * Owns: stats, recent transactions, recent tickets, audit logs, admin
 * name map, sosCount, polling lifecycle (30s + Page Visibility).
 */
export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [adminNames, setAdminNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sosCount, setSosCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        fetch('/api/admin/dashboard?trend=true'),
        fetch('/api/admin/transactions?limit=5'),
        fetch('/api/admin/tickets?limit=10'),
        fetch('/api/admin/audit-logs?limit=20'),
      ]);

      const [statsRes, txRes, ticketsRes, logsRes] = results.map((r) =>
        r.status === 'fulfilled' ? r.value : null
      );

      if (statsRes?.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.data);
      }
      if (txRes?.ok) {
        const txJson = await txRes.json();
        setRecentTransactions(txJson.data || []);
      }
      if (ticketsRes?.ok) {
        const ticketsJson = await ticketsRes.json();
        const tickets: RecentTicket[] = ticketsJson.data || [];
        setRecentTickets(tickets.slice(0, 5));
        const openSos = tickets.filter(
          (t) =>
            t.category === 'SOS' &&
            t.status === 'OPEN' &&
            (t.priority === 'CRITICAL' || t.priority === 'HIGH')
        ).length;
        setSosCount(openSos);
      }
      if (logsRes?.ok) {
        const logsJson = await logsRes.json();
        setAuditLogs(Array.isArray(logsJson.data) ? logsJson.data : []);
      }
      setLastUpdated(new Date());
    } catch (error) {
      logger.error('Failed to fetch dashboard data', { error });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAdminNames = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/admins?limit=50');
      if (res.ok) {
        const json = await res.json();
        const admins = json.data || [];
        const map = new Map<string, string>();
        for (const a of admins) {
          if (a.id && a.name) map.set(a.id, a.name);
        }
        setAdminNames(map);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAdminNames();
  }, [fetchData, fetchAdminNames]);

  useEffect(() => {
    intervalRef.current = setInterval(
      () => void fetchData(true),
      DASHBOARD_POLL_INTERVAL_MS
    );
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        void fetchData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  return {
    // data
    stats,
    recentTransactions,
    recentTickets,
    auditLogs,
    adminNames,
    sosCount,
    // status
    loading,
    refreshing,
    lastUpdated,
    // revalidation
    fetchData,
  };
}

export type DashboardHook = ReturnType<typeof useDashboard>;
