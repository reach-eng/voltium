'use client';

import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from './types';

interface RevenueTrendChartProps {
  data: TrendPoint[];
}

/**
 * R3.7z split — last-7-days revenue + active-riders area chart.
 * recharts is heavy-coupled enough that the chart lives in its own
 * file rather than being split further.
 */
export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  // P2: sanitize points — an undefined/null revenue or riders value
  // breaks the empty check and poisons recharts scales.
  const points = (data ?? []).map((d) => ({
    date: d?.date ?? '—',
    revenue: typeof d?.revenue === 'number' && Number.isFinite(d.revenue) ? d.revenue : 0,
    riders: typeof d?.riders === 'number' && Number.isFinite(d.riders) ? d.riders : 0,
  }));
  const isEmpty =
    points.length === 0 || points.every((d) => d.revenue === 0 && d.riders === 0);
  // Unique gradient IDs so two mounted charts never collide on url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const revenueGradientId = `colorRevenue-${uid}`;
  const ridersGradientId = `colorRiders-${uid}`;
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold">Revenue Trend</CardTitle>
          <p className="text-xs text-muted-foreground">
            {/* P2: riders series counts distinct transacting riders/day,
                not active riders — label it honestly. */}
            Last 7 days — revenue and transacting riders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/5 border border-primary/10">
            <div aria-hidden="true" className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-medium text-primary">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10">
            <div aria-hidden="true" className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              Riders
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        {/* Screen-reader table fallback — the AreaChart is SVG only. */}
        <table className="sr-only">
          <caption>Revenue and transacting riders by day</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Revenue (₹)</th>
              <th scope="col">Riders</th>
            </tr>
          </thead>
          <tbody>
            {points.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.revenue}</td>
                <td>{d.riders}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isEmpty ? (
          <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm font-medium">No trend data yet</p>
            <p className="text-xs mt-1">Revenue appears after the first approved rent payment.</p>
          </div>
        ) : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={revenueGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0369a1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={ridersGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickFormatter={(val: number) => (val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor:
                    'color-mix(in srgb, var(--card) 80%, transparent)',
                  backdropFilter: 'blur(12px)',
                  borderColor: 'var(--border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
                cursor={{
                  stroke: 'var(--primary)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
                formatter={(value: unknown, name: unknown) => {
                  if (name === 'revenue') return [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue'];
                  return [String(value), 'Riders'];
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${revenueGradientId})`}
                animationDuration={1500}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="riders"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${ridersGradientId})`}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
