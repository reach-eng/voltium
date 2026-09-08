'use client';

import { useCallback, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStore } from '@/store/admin';
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
 */
export default function DashboardOverview() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const d = useDashboard();

  const [healthOpen, setHealthOpen] = useState(false);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  const handleExport = useCallback(() => {
    if (!d.stats) return;
    downloadReport(buildReportCsv(d.stats, d.recentTransactions));
  }, [d.stats, d.recentTransactions]);

  const handleSystemHealth = useCallback(async () => {
    setHealthOpen(true);
    setHealthLoading(true);
    const checks = await runHealthChecks();
    setHealthChecks(checks);
    setHealthLoading(false);
  }, []);

  if (d.loading) {
    return (
      <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
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

  // P0: without this branch a total stats failure (now correctly reported
  // via d.error, including network rejects) rendered an empty dashboard
  // with a fresh timestamp and no explanation.
  if (d.error && !d.stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
          <span aria-hidden="true">⚠</span>
        </div>
        <h3 className="text-lg font-semibold">Dashboard unavailable</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{d.error}</p>
        <button
          onClick={() => void d.fetchData()}
          className="mt-4 px-5 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90"
        >
          Retry
        </button>
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
        exportDisabled={!d.stats}
      />

      {d.error && d.stats && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-4"
        >
          <span>{d.error} — showing last known data from {d.lastUpdated ? d.lastUpdated.toLocaleTimeString('en-IN') : 'cache'}.</span>
          <button onClick={() => void d.fetchData()} className="underline font-medium shrink-0">Retry</button>
        </div>
      )}

      {d.forbiddenSections.length > 0 && (
        <div
          role="note"
          className="rounded-xl border border-slate-500/30 bg-slate-500/10 px-4 py-2 text-sm text-slate-700 dark:text-slate-300"
        >
          Your role has no access to: {d.forbiddenSections.join(', ')}. Those
          sections are hidden rather than empty — contact an administrator if
          you need access.
        </div>
      )}

      <SosAlert
        count={d.sosCount}
        confirmed={d.sosConfirmed}
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
            accessDenied={d.forbiddenSections.includes('transactions')}
          />
          <RecentTicketsCard
            tickets={d.recentTickets}
            onCardClick={() => setActiveSection('tickets')}
            accessDenied={d.forbiddenSections.includes('tickets')}
          />
        </div>
        <div className="lg:col-span-4">
          <ActivityStream
            logs={d.auditLogs}
            adminNames={d.adminNames}
            accessDenied={d.forbiddenSections.includes('activity')}
          />
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
