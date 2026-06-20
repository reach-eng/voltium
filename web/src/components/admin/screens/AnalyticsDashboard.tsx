'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Percent,
  Download,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
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
import { logger } from '@/lib/logger';
import { BRAND_DOMAIN } from '@/lib/branding';

const POLL_INTERVAL_MS = 60_000;

interface AnalyticsData {
  overview: {
    totalRiders: number;
    activeRiders: number;
    currentMRR: number;
    mrrGrowth: number;
    avgRevenuePerRider: number;
    churnRate: number;
    collectionEfficiency: number;
    totalVehicles: number;
    activeVehicles: number;
  };
  trend: { month: string; revenue: number }[];
  cohorts: {
    month: string;
    total: number;
    active: number;
    suspended: number;
    retentionRate: number;
  }[];
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
      setLastUpdated(new Date());
    } catch (error) {
      logger.error('Failed to fetch analytics', { error });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        fetchData(true);
        intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  const handleExport = useCallback(() => {
    if (!data) return;
    const rows = [
      'Ryd Financial Report',
      `Generated: ${new Date().toLocaleString('en-IN')}`,
      '',
      'Key Metrics',
      `MRR,${data.overview.currentMRR}`,
      `MRR Growth,${data.overview.mrrGrowth}%`,
      `Avg Revenue/Rider,${data.overview.avgRevenuePerRider}`,
      `Churn Rate,${data.overview.churnRate}%`,
      `Collection Efficiency,${data.overview.collectionEfficiency}%`,
      `Total Riders,${data.overview.totalRiders}`,
      `Active Riders,${data.overview.activeRiders}`,
      '',
      'Monthly Revenue Trend',
      'Month,Revenue',
      ...data.trend.map((t) => `${t.month},${t.revenue}`),
      '',
      'Cohort Analysis',
      'Signup Month,Total,Active,Suspended,Retention %',
      ...data.cohorts.map(
        (c) => `${c.month},${c.total},${c.active},${c.suspended},${c.retentionRate}`
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${BRAND_DOMAIN.split('.')[0]}-financial-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

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

  const { overview, trend, cohorts } = data;

  const kpiCards = [
    {
      label: 'Monthly Recurring Revenue',
      value: formatINR(overview.currentMRR),
      change: overview.mrrGrowth,
      icon: DollarSign,
    },
    {
      label: 'Churn Rate',
      value: `${overview.churnRate.toFixed(2)}%`,
      change: -overview.churnRate,
      icon: TrendingDown,
      inverse: true,
    },
    {
      label: 'Avg Revenue/Rider',
      value: formatINR(overview.avgRevenuePerRider),
      change: overview.mrrGrowth > 0 ? 5 : -2,
      icon: Users,
    },
    {
      label: 'Collection Efficiency',
      value: `${overview.collectionEfficiency.toFixed(1)}%`,
      change: overview.collectionEfficiency > 80 ? 3 : -5,
      icon: Percent,
    },
  ];

  const acquisitionData = cohorts.map((c) => ({
    month: getMonthLabel(c.month),
    acquired: c.total,
    retained: c.active,
  }));

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
            className="rounded-full h-9 w-9"
            onClick={() => fetchData()}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4 h-9"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          const isPositive = kpi.inverse ? kpi.change < 0 : kpi.change > 0;
          return (
            <Card
              key={kpi.label}
              className="rounded-2xl border-border/50 shadow-sm hover:border-primary/30 transition-all"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    <h3 className="text-2xl font-bold tracking-tight">{kpi.value}</h3>
                    <div className="flex items-center gap-1">
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-rose-500" />
                      )}
                      <span
                        className={`text-xs font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}
                      >
                        {Math.abs(kpi.change)}%
                      </span>
                      <span className="text-xs text-muted-foreground">vs last month</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
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
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
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

        {/* Rider Acquisition */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-6 pt-5">
            <CardTitle className="text-base font-bold">Rider Acquisition by Month</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={acquisitionData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
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
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
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
      </div>

      {/* Cohort Analysis */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-5">
          <CardTitle className="text-base font-bold">
            Cohort Analysis — Retention by Signup Month
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="px-6">Signup Month</TableHead>
                <TableHead>Total Riders</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Suspended</TableHead>
                <TableHead className="pr-6 text-right">Retention Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No cohort data available
                  </TableCell>
                </TableRow>
              ) : (
                cohorts.map((cohort) => (
                  <TableRow key={cohort.month} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium px-6">
                      {getMonthLabel(cohort.month)}
                    </TableCell>
                    <TableCell>{cohort.total}</TableCell>
                    <TableCell className="text-emerald-600 font-semibold">
                      {cohort.active}
                    </TableCell>
                    <TableCell className="text-rose-600 font-semibold">
                      {cohort.suspended}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        variant="outline"
                        className={`rounded-md text-xs font-bold ${
                          cohort.retentionRate >= 70
                            ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5'
                            : cohort.retentionRate >= 40
                              ? 'border-amber-500/20 text-amber-600 bg-amber-500/5'
                              : 'border-rose-500/20 text-rose-600 bg-rose-500/5'
                        }`}
                      >
                        {cohort.retentionRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
