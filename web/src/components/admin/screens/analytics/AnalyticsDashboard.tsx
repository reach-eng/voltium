'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { useAnalytics } from './useAnalytics';
import { exportAnalyticsCsv } from './analyticsExport';
import { formatINR, getMonthLabel, type AnalyticsData } from './analyticsTypes';
import { AnalyticsKpiCards } from './AnalyticsKpiCards';
import { CohortTable } from './CohortTable';

/**
 * R3.7c split — Analytics Dashboard shell. After the split this file
 * is a thin orchestrator (~150 lines) that:
 *   1. Owns the data via `useAnalytics` (60s polling + visibility handling)
 *   2. Renders the header (refresh button + export button)
 *   3. Renders the 4 KPI cards (AnalyticsKpiCards)
 *   4. Renders the 2 charts inline (small enough to keep)
 *   5. Renders the cohort analysis table (CohortTable)
 *
 * Pre-split: 16.6 KB / 477 lines
 * Post-split: ~6 KB shell + useAnalytics (2.1 KB) + analyticsTypes
 *             (1.4 KB) + analyticsExport (1.6 KB) + AnalyticsKpiCards
 *             (3 KB) + CohortTable (3 KB)
 *
 * The 2 charts (revenue trend + rider acquisition) are kept inline
 * because they're <30 lines each and heavily coupled to recharts
 * internals; splitting them out would just add file noise.
 */
export default function AnalyticsDashboard() {
  const { data, loading, refreshing, lastUpdated, fetchData } = useAnalytics();
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!data) return;
    setExporting(true);
    try {
      exportAnalyticsCsv(data);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Revenue & Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Financial performance and rider retention metrics
            {lastUpdated && (
              <>
                {' '}
                — Updated{' '}
                {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-11 w-11 transition-all duration-200"
            onClick={() => fetchData()}
            disabled={refreshing}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="default"
            className="rounded-full px-5 h-11 font-medium transition-all duration-200"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="w-5 h-5 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <AnalyticsKpiCards overview={data.overview} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueTrendChart trend={data.trend} />
        <AcquisitionChart cohorts={data.cohorts} />
      </div>

      <CohortTable cohorts={data.cohorts} />
    </div>
  );
}

/** 12-month revenue trend area chart. Kept inline because it couples
 * tightly to recharts internals (color gradient defs, tooltip styles). */
function RevenueTrendChart({ trend }: { trend: AnalyticsData['trend'] }) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 px-6 pt-5">
        <CardTitle className="text-base font-bold">12-Month Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                tickFormatter={(m: string) => getMonthLabel(m)}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                tickFormatter={(val) => `₹${val / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'color-mix(in srgb, var(--card) 80%, transparent)',
                  backdropFilter: 'blur(12px)',
                  borderColor: 'var(--border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => formatINR(value)}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/** Rider acquisition by month (acquired vs retained). Kept inline. */
function AcquisitionChart({ cohorts }: { cohorts: AnalyticsData['cohorts'] }) {
  const data = cohorts.map((c) => ({
    month: getMonthLabel(c.month),
    acquired: c.total,
    retained: c.active,
  }));
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 px-6 pt-5">
        <CardTitle className="text-base font-bold">Rider Acquisition by Month</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'color-mix(in srgb, var(--card) 80%, transparent)',
                  backdropFilter: 'blur(12px)',
                  borderColor: 'var(--border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar
                dataKey="acquired"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                name="Acquired"
              />
              <Bar dataKey="retained" fill="#10b981" radius={[4, 4, 0, 0]} name="Retained" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
