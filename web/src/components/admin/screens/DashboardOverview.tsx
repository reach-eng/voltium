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
