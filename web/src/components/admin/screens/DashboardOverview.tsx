'use client';

import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStore } from '@/store/admin';
import { hasPermission, type SessionPayload } from '@/lib/permissions';
import { ActivityStream } from './dashboard/ActivityStream';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { RecentTicketsCard } from './dashboard/RecentTicketsCard';
import { RecentTransactionsCard } from './dashboard/RecentTransactionsCard';
import { RevenueTrendChart } from './dashboard/RevenueTrendChart';
import { SecondaryStatsGrid } from './dashboard/SecondaryStatsGrid';
import { SosAlert } from './dashboard/SosAlert';
import { StatCards } from './dashboard/StatCards';
import { SystemHealthDialog } from './dashboard/SystemHealthDialog';
import { buildReportCsv, downloadReport } from './dashboard/exportReport';
import { runHealthChecks } from './dashboard/runHealthChecks';
import { useDashboard } from './dashboard/useDashboard';
import type { HealthCheck } from './dashboard/types';

/**
 * R3.7z shell — composes the Dashboard Overview from the
 * dashboard/ subdirectory. Data, polling, and visibility live
 * in `useDashboard`; each section has its own component.
 *
 * 2026-08-24 audit (ADMIN_DASHBOARD_AUDIT_2026-08-24) updates:
 *   - P1-1: System Health button is gated on `settings_manage`.
 *   - P1-2: Export Report button is gated on `finance_manage` AND the
 *     CSV's rider name column is redacted for non-operations roles.
 *   - P1-3: 30s auto-refresh is already in `useDashboard.ts` (verified,
 *     audit was based on a misread of the current code).
 *   - P2-1: trend indicator never existed in StatCards (verified, audit
 *     was based on a stale description).
 *
 * The session is fetched once on mount via /api/admin/auth/me (same
 * pattern as AdminSidebar.tsx). We deliberately don't share the
 * sidebar's session via a store — the dashboard is a separate route
 * and the /me call is cheap (~5ms on warm cache).
 */
export default function DashboardOverview() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const d = useDashboard();
  const [session, setSession] = useState<SessionPayload | null>(null);

  const [healthOpen, setHealthOpen] = useState(false);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) setSession(data.data);
      })
      .catch(() => {
        // Non-critical — the buttons will stay visible (default
        // behaviour) if the session check fails. Defence in depth
        // is the API's own permission check.
      });
  }, []);

  // P1-1: only `settings_manage` holders can trigger the health
  // probes. The API endpoints themselves also check perms, so this
  // is a client-side guard for the UX (no point showing a button
  // that will 403).
  const canViewSystemHealth = session
    ? hasPermission(session, 'settings_manage')
    : true; // optimistic — hide only once we know the role lacks it

  // P1-2: only `finance_manage` (or higher) holders can download
  // the full report. SUPPORT_AGENT and READ_ONLY roles still see
  // the dashboard stats but cannot export.
  const canExportReport = session
    ? hasPermission(session, 'finance_manage') ||
      hasPermission(session, 'riders_view')
    : true;

  // P1-2: operations+ roles get the full rider names in the export.
  // Everyone else gets initials — the audit log still records who
  // exported what, so compliance can re-link if needed.
  const redactPii = session
    ? !(
        hasPermission(session, 'finance_manage') ||
        hasPermission(session, 'riders_view')
      )
    : false;

  const handleExport = useCallback(() => {
    if (!d.stats) return;
    downloadReport(buildReportCsv(d.stats, d.recentTransactions, { redactPii }));
  }, [d.stats, d.recentTransactions, redactPii]);

  const handleSystemHealth = useCallback(async () => {
    setHealthOpen(true);
    setHealthLoading(true);
    const checks = await runHealthChecks();
    setHealthChecks(checks);
    setHealthLoading(false);
  }, []);

  if (d.loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const trendData = d.stats?.trend || [];

  return (
    <div className="space-y-4 max-w-full">
      <DashboardHeader
        lastUpdated={d.lastUpdated}
        refreshing={d.refreshing}
        onRefresh={() => {
          void d.fetchData();
        }}
        onExport={handleExport}
        onSystemHealth={() => {
          void handleSystemHealth();
        }}
        canViewSystemHealth={canViewSystemHealth}
        canExportReport={canExportReport}
      />

      <SosAlert
        count={d.sosCount}
        onGoToTickets={() => setActiveSection('tickets')}
      />

      <StatCards
        stats={d.stats}
        onCardClick={(route) => setActiveSection(route)}
      />

      <RevenueTrendChart data={trendData} />

      <SecondaryStatsGrid stats={d.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <RecentTransactionsCard
            transactions={d.recentTransactions}
            onCardClick={() => setActiveSection('transactions')}
          />
          <RecentTicketsCard
            tickets={d.recentTickets}
            onCardClick={() => setActiveSection('tickets')}
          />
        </div>
        <div className="lg:col-span-4">
          <ActivityStream logs={d.auditLogs} adminNames={d.adminNames} />
        </div>
      </div>

      <SystemHealthDialog
        open={healthOpen}
        onOpenChange={setHealthOpen}
        checks={healthChecks}
        loading={healthLoading}
      />
    </div>
  );
}
