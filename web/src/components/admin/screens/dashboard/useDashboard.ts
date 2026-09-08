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
  // P1: distinguishes "confirmed no SOS" from "tickets/stats fetch
  // failed" — the banner must not reassure while the data is unknown.
  const [sosConfirmed, setSosConfirmed] = useState(false);
  // P1: per-section access tracking — roles without transactions /
  // tickets / audit permission get 403s that previously rendered as
  // silently-empty tables. Surfaced as "no access" notices instead.
  const [forbiddenSections, setForbiddenSections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // P2: abort in-flight polls on unmount / superseding refresh so slow
  // responses can't overwrite fresher state after navigation.
  const abortRef = useRef<AbortController | null>(null);
  // Tracks whether stats ever loaded without subscribing the fetch
  // callback to `stats` (which caused a self-triggering refetch loop).
  const hasStatsRef = useRef(false);

  const fetchAdminNames = useCallback(async (logs: AuditLogEntry[]) => {
    try {
      const actorIds = Array.from(
        new Set(logs.map((l) => l.actorId).filter((id): id is string => Boolean(id)))
      );
      if (actorIds.length === 0) return;

      const res = await fetch(`/api/admin/admins/lookup?ids=${encodeURIComponent(actorIds.join(','))}`);
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

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    // P2: supersede any in-flight poll — its late response must not
    // overwrite this fresher one. Unmount cleanup aborts too (below).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    let hadError = false;
    try {
      const results = await Promise.allSettled([
        fetch('/api/admin/dashboard?trend=true', { signal }),
        fetch('/api/admin/transactions?limit=5', { signal }),
        // P1: lean projection — the card renders display fields only; skip
        // rider PII/message bodies/attachments on this 30s poll.
        fetch('/api/admin/tickets?limit=10&lean=true', { signal }),
        fetch('/api/admin/audit-logs?limit=20', { signal }),
      ]);
      // Aborted by a superseding refresh or unmount — discard everything.
      if (signal.aborted) return;
      // P0: a rejected fetch (offline/DNS/CORS) yields null, which
      // previously hit neither branch below — hadError stayed false, no
      // error showed, and lastUpdated advanced dishonestly.
      if (results.some((r) => r.status === 'rejected')) {
        hadError = true;
      }

      const [statsRes, txRes, ticketsRes, logsRes] = results.map((r) =>
        r.status === 'fulfilled' ? r.value : null
      );

      if (statsRes?.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.data);
        hasStatsRef.current = true;
        // SOS count = 24h emergency.sos_triggered audit events,
        // evaluated server-side (tickets have no SOS category).
        if (typeof statsJson.data?.sosCount === 'number') {
          setSosCount(statsJson.data.sosCount);
          setSosConfirmed(true);
        }
        setError(null);
      } else {
        // Covers BOTH non-OK responses and null (network rejection), in
        // foreground AND background. With old stats this drives the
        // "showing last known data" banner; without, the error screen.
        // SOS stays unconfirmed on unknown data.
        hadError = true;
        const statusLabel =
          statsRes ? `HTTP ${(statsRes as Response).status}` : 'network error';
        logger.error('Dashboard stats fetch failed', { status: statusLabel });
        setSosConfirmed(false);
        // The shell appends "showing last known data from …" when old
        // stats exist, or renders the full error screen otherwise.
        setError(`Dashboard stats unavailable (${statusLabel})`);
      }
      const forbidden: string[] = [];
      if (txRes?.ok) {
        const txJson = await txRes.json();
        setRecentTransactions(txJson.data || []);
      } else if (txRes) {
        hadError = true;
        if ((txRes as Response).status === 403) forbidden.push('transactions');
      }
      if (ticketsRes?.ok) {
        const ticketsJson = await ticketsRes.json();
        const tickets: RecentTicket[] = ticketsJson.data || [];
        // SOS truth comes only from stats.sosCount — tickets have no SOS
        // category, so counting any slice here could only ever yield 0.
        setRecentTickets(tickets.slice(0, 5));
      } else if (ticketsRes) {
        hadError = true;
        setSosConfirmed(false);
        if ((ticketsRes as Response).status === 403) forbidden.push('tickets');
      }
      if (logsRes?.ok) {
        const logsJson = await logsRes.json();
        const logs = Array.isArray(logsJson.data) ? logsJson.data : [];
        setAuditLogs(logs);
        // Fire-and-forget name lookup without blocking stats freshness.
        void fetchAdminNames(logs);
      } else if (logsRes && (logsRes as Response).status === 403) {
        forbidden.push('activity');
      }
      setForbiddenSections(forbidden);
      if (!hadError) setError(null);
      // "Updated …" stamps only clean rounds, never failures.
      if (!hadError) setLastUpdated(new Date());
    } catch (error) {
      // AbortError from a superseded poll is routine, not an error.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      logger.error('Failed to fetch dashboard data', { error });
      if (!isBackground) setError('Failed to fetch dashboard data. Check network and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAdminNames]);

  useEffect(() => {
    void fetchData();
    // Abort in-flight poll on unmount.
    return () => abortRef.current?.abort();
  }, [fetchData]);

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
        intervalRef.current = null;
        abortRef.current?.abort();
      } else {
        void fetchData(true);
        // Re-create the interval on foreground. The old handler cleared
        // it on hidden but never re-created it, so polling died forever
        // after one background/foreground cycle.
        if (!intervalRef.current) {
          intervalRef.current = setInterval(
            () => void fetchData(true),
            DASHBOARD_POLL_INTERVAL_MS
          );
        }
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
    sosConfirmed,
    forbiddenSections,
    // status
    loading,
    refreshing,
    lastUpdated,
    error,
    // revalidation
    fetchData,
  };
}

export type DashboardHook = ReturnType<typeof useDashboard>;
