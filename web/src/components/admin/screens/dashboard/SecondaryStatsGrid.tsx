'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStats } from './types';

interface SecondaryStatsGridProps {
  stats: DashboardStats | null;
}

interface Stat {
  label: string;
  value: number | null | undefined;
}

/**
 * R3.7z split — 5-tile All Metrics grid below the trend chart.
 */
export function SecondaryStatsGrid({ stats }: SecondaryStatsGridProps) {
  const items: Stat[] = stats
    ? [
        { label: 'Total Riders', value: stats.totalRiders },
        { label: 'Total Fleet', value: stats.totalVehicles },
        { label: 'Hubs', value: stats.totalHubs },
        { label: 'Active Admins', value: stats.totalAdmins },
        { label: 'Pending Info', value: stats.pendingInfoRequired ?? 0 },
      ]
    : [];

  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 px-6 pt-5">
        <CardTitle className="text-base font-semibold">All Metrics</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y divide-border/30">
          {items.map((item) => {
            // P2: match StatCards — non-finite renders as em dash (never
            // "NaN") with en-IN grouping and tabular numerals.
            const display =
              typeof item.value === 'number' && Number.isFinite(item.value)
                ? item.value.toLocaleString('en-IN')
                : '—';
            return (
              <div key={item.label} className="px-4 py-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {display}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
