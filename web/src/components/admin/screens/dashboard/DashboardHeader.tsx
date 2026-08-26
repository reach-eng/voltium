'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

interface DashboardHeaderProps {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
  onExport: () => void;
  onSystemHealth: () => void;
}

/**
 * R3.7z split — greeting row + refresh / export / system-health buttons.
 */
export function DashboardHeader({
  lastUpdated,
  refreshing,
  onRefresh,
  onExport,
  onSystemHealth,
}: DashboardHeaderProps) {
  const today = formatDateDDMMYYYY(new Date().toISOString());

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back, Admin
        </h2>
        <p className="text-muted-foreground flex items-center gap-2 mt-1">
          {today}
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Operations
          </span>
          {lastUpdated && (
            <>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="text-xs">
                Updated{' '}
                {lastUpdated.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-11 w-11 transition-all duration-200"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh dashboard"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="outline"
          size="default"
          className="rounded-full px-5 h-11 font-medium transition-all duration-200"
          onClick={onExport}
        >
          Export Report
        </Button>
        <Button
          size="default"
          className="rounded-full px-5 h-11 font-medium transition-all duration-200"
          onClick={onSystemHealth}
        >
          System Health
        </Button>
      </div>
    </div>
  );
}
