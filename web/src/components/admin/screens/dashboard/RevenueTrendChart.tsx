'use client';

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
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold">Revenue Trend</CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 7 days — revenue and active riders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/5 border border-primary/10">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-medium text-primary">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              Riders
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0369a1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRiders" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(val) => `₹${val / 1000}k`}
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
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                animationDuration={1500}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="riders"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRiders)"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
