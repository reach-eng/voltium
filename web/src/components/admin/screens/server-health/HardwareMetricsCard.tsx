'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu } from 'lucide-react';
import type { ServerHealth } from './types';

interface HardwareMetricsCardProps {
  health: ServerHealth;
}

/**
 * R3.7i split — Hardware Metrics card.
 *
 * Three metrics in a 3-col grid: CPU utilisation, host RAM, and disk
 * space remaining (with total). The card spans both columns of the
 * outer grid.
 *
 * P2-4: the row is labelled "Host RAM" (machine) with a sub-line
 * "Process heap: N/A" — the second source (admin server-health
 * route's process RSS+heap) was deleted by P1-6, so there is no
 * second number to display. Keeping the label honest avoids the
 * "RAM 41% but heap 900MB" confusion called out in the audit.
 *
 * P2-5a: disk GB is formatted with one decimal so 512 MB doesn't
 * round to 0. The hook currently passes already-rounded whole GB
 * (legacy from before the audit); once the in-flight branch passes
 * full MB, this formatter will produce e.g. "0.5 GB".
 */
export function HardwareMetricsCard({ health }: HardwareMetricsCardProps) {
  // Format a disk-GB value with one decimal. Accept either whole
  // GB (legacy hook) or raw MB (planned hook change). The divisor
  // is decided by magnitude: <1000 is whole-GB; >=1000 is MB.
  const fmtGb = (v: number | '—'): string => {
    if (v === '—') return '—';
    if (v >= 1000) return `${(v / 1024).toFixed(1)} GB`; // raw MB
    return `${v.toFixed(1)} GB`; // already whole GB
  };
  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-base font-bold">Server Hardware Metrics</CardTitle>
        <Cpu className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase">CPU Utilization</div>
          <div className="text-2xl font-bold">{health.cpuUsage}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase">Host RAM</div>
          <div className="text-2xl font-bold">{health.ramUsage}</div>
          <div className="text-xs text-muted-foreground">Process heap: N/A</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase">
            Disk Space (Remaining)
          </div>
          <div className="text-2xl font-bold">
            {fmtGb(health.freeDiskGb)}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              / {fmtGb(health.totalDiskGb)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
