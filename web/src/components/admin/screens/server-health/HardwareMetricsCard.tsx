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
 * Three metrics in a 3-col grid: CPU utilisation, RAM usage, and disk
 * space remaining (with total). The card spans both columns of the
 * outer grid. (2026-08-07 verification: the doc comment previously
 * claimed RAM showed uptime — the hook actually feeds memoryCheck
 * into ramUsage, so the labels and data were always aligned.)
 */
export function HardwareMetricsCard({ health }: HardwareMetricsCardProps) {
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
          <div className="text-xs text-muted-foreground uppercase">RAM Usage</div>
          <div className="text-2xl font-bold">{health.ramUsage}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground uppercase">
            Disk Space (Remaining)
          </div>
          <div className="text-2xl font-bold">
            {health.freeDiskGb} GB{' '}
            <span className="text-xs font-normal text-muted-foreground">
              / {health.totalDiskGb} GB
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
