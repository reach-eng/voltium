'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminStore } from '@/store/admin';
import {
  Users,
  CalendarDays,
  IndianRupee,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  History,
  Clock,
  Bike,
} from 'lucide-react';
import { BRAND_SHORT, BRAND_DOMAIN } from '@/lib/branding';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { logger } from '@/lib/logger';

const POLL_INTERVAL_MS = 30_000;

interface TrendPoint {
  date: string;
  revenue: number;
  riders: number;
}

interface DashboardStats {
  totalRiders: number;
  activeRiders: number;
  totalVehicles: number;
  availableVehicles: number;
  totalBalance: number;
  totalDeposits: number;
  pendingTransactions: number;
  openTickets: number;
  activeRentals: number;
  totalHubs: number;
  pendingKyc: number;
  pendingGuarantor: number;
  pendingInfoRequired: number;
  totalAdmins: number;
  trend?: TrendPoint[];
}

interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  purpose: string;
  status: string;
  createdAt: string;
  rider?: { fullName: string | null; name: string | null; riderId: string };
}

interface RecentTicket {
  id: string;
  ticketId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  rider?: { fullName: string | null; name: string | null; riderId: string };
}

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorId: string | null;
  details: any;
  createdAt: string;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const statCards: { key: string; label: string; icon: any; route: string; format?: boolean }[] = [
  { key: 'activeRiders', label: 'Active Riders', icon: Users, route: 'riders' },
  { key: 'availableVehicles', label: 'Available Fleet', icon: Bike, route: 'vehicles' },
  { key: 'totalBalance', label: 'Revenue', icon: IndianRupee, route: 'transactions', format: true },
  {
    key: 'totalDeposits',
    label: 'Deposits Held',
    icon: ShieldAlert,
    route: 'transactions',
    format: true,
  },
  { key: 'pendingTransactions', label: 'Pending Payouts', icon: Clock, route: 'transactions' },
  { key: 'pendingKyc', label: 'KYC Backlog', icon: AlertTriangle, route: 'kyc' },
  { key: 'openTickets', label: 'Open Tickets', icon: MessageSquare, route: 'tickets' },
  { key: 'activeRentals', label: 'Active Rentals', icon: CalendarDays, route: 'rentals' },
];

interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  latencyMs: number;
  detail: string;
}

async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  const apiStart = performance.now();
  try {
    const r = await fetch('/api/admin/dashboard');
    const latency = Math.round(performance.now() - apiStart);
    checks.push({
      name: 'API Server',
      status: r.ok ? (latency > 2000 ? 'warn' : 'ok') : 'error',
      latencyMs: latency,
      detail: r.ok ? `${latency}ms response` : `HTTP ${r.status}`,
    });
  } catch {
    checks.push({ name: 'API Server', status: 'error', latencyMs: 0, detail: 'Unreachable' });
  }

  const dbStart = performance.now();
  try {
    const r = await fetch('/api/admin/tickets?limit=1');
    const latency = Math.round(performance.now() - dbStart);
    checks.push({
      name: 'Database',
      status: r.ok ? (latency > 3000 ? 'warn' : 'ok') : 'error',
      latencyMs: latency,
      detail: r.ok ? `Query in ${latency}ms` : 'Connection failed',
    });
  } catch {
    checks.push({ name: 'Database', status: 'error', latencyMs: 0, detail: 'Unreachable' });
  }

  return checks;
}

export default function DashboardOverview() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [adminNames, setAdminNames] = useState<Map<string, string>>(new Map());
  const [sosCount, setSosCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        fetch('/api/admin/dashboard?trend=true'),
        fetch('/api/admin/transactions?limit=5'),
        fetch('/api/admin/tickets?limit=10'),
        fetch('/api/admin/audit-logs?limit=20'),
      ]);

      const [statsRes, txRes, ticketsRes, logsRes] = results.map((r) =>
        r.status === 'fulfilled' ? r.value : null
      );

      if (statsRes?.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.data);
      }
      if (txRes?.ok) {
        const txJson = await txRes.json();
        setRecentTransactions(txJson.data || []);
      }
      if (ticketsRes?.ok) {
        const ticketsJson = await ticketsRes.json();
        const tickets = ticketsJson.data || [];
        setRecentTickets(tickets.slice(0, 5));
        const openSos = tickets.filter(
          (t: RecentTicket) =>
            t.category === 'SOS' &&
            t.status === 'OPEN' &&
            (t.priority === 'CRITICAL' || t.priority === 'HIGH')
        ).length;
        setSosCount(openSos);
      }
      if (logsRes?.ok) {
        const logsJson = await logsRes.json();
        setAuditLogs(Array.isArray(logsJson.data) ? logsJson.data : []);
      }
      setLastUpdated(new Date());
    } catch (error) {
      logger.error('Failed to fetch dashboard data', { error });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAdminNames = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/admins?limit=50');
      if (res.ok) {
        const json = await res.json();
        const admins = json.data || [];
        const map = new Map<string, string>();
        for (const a of admins) {
          if (a.id && a.name) map.set(a.id, a.name);
        }
        setAdminNames(map);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAdminNames();
  }, [fetchData, fetchAdminNames]);

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
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  const handleExportReport = useCallback(() => {
    if (!stats) return;
    const report = [
      `${BRAND_SHORT} Dashboard Report`,
      `Generated: ${new Date().toLocaleString('en-IN')}`,
      '',
      'Key Metrics',
      `Active Riders,${stats.activeRiders}`,
      `Available Vehicles,${stats.availableVehicles}`,
      `Total Revenue,${stats.totalBalance}`,
      `Pending Transactions,${stats.pendingTransactions}`,
      `Open Tickets,${stats.openTickets}`,
      `Active Rentals,${stats.activeRentals}`,
      '',
      'Recent Transactions',
      'Rider,Amount,Status,Date',
      ...recentTransactions.map(
        (tx) =>
          `${tx.rider?.fullName || tx.rider?.name || 'Unknown'},${tx.amount},${tx.status},${formatDate(tx.createdAt)}`
      ),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${BRAND_DOMAIN.split('.')[0]}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stats, recentTransactions]);

  const handleSystemHealth = useCallback(async () => {
    setHealthOpen(true);
    setHealthLoading(true);
    const checks = await runHealthChecks();
    setHealthChecks(checks);
    setHealthLoading(false);
  }, []);

  if (loading) {
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

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const trendData = stats?.trend || [];
  const secondaryStats = stats
    ? [
        { label: 'Total Riders', value: stats.totalRiders },
        { label: 'Total Fleet', value: stats.totalVehicles },
        { label: 'Hubs', value: stats.totalHubs },
        { label: 'Active Admins', value: stats.totalAdmins },
        { label: 'Pending Info', value: stats.pendingInfoRequired ?? 0 },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-full">
      {/* Greeting Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, Admin</h2>
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
                  {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-9 w-9"
            onClick={() => fetchData()}
            disabled={refreshing}
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full px-4 h-9"
            onClick={handleExportReport}
          >
            Export Report
          </Button>
          <Button size="sm" className="rounded-full px-4 h-9" onClick={handleSystemHealth}>
            System Health
          </Button>
        </div>
      </div>

      {/* SOS Alert */}
      {sosCount > 0 && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5 shadow-lg shadow-rose-500/10 overflow-hidden ring-1 ring-rose-500/20">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-25" />
                  <div className="relative w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/40">
                    <ShieldAlert className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-rose-600 dark:text-rose-400">
                    Emergency SOS Detected
                  </h4>
                  <p className="text-sm text-rose-500 font-medium">
                    {sosCount} critical safety{' '}
                    {sosCount === 1 ? 'ticket requires' : 'tickets require'} immediate action
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setActiveSection('tickets')}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 px-8"
              >
                Go to SOS Hub
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 auto-rows-fr">
        {statCards.map((card) => {
          const value = stats?.[card.key as keyof DashboardStats] || 0;
          const Icon = card.icon;
          const kycInfo =
            card.key === 'pendingKyc' && stats?.pendingInfoRequired
              ? ` (${stats.pendingInfoRequired} need correction)`
              : '';

          return (
            <Card
              key={card.key}
              className="h-full rounded-2xl border-border/50 shadow-sm hover:border-primary/30 transition-all duration-300 cursor-pointer group"
              onClick={() => setActiveSection(card.route)}
            >
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between relative z-10">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">
                      {card.label}
                    </p>
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">
                      {card.format
                        ? formatINR(value as number)
                        : (value as number).toLocaleString('en-IN')}
                    </h3>
                    {kycInfo && <p className="text-xs text-muted-foreground">{kycInfo}</p>}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue Trend Chart */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold">Revenue Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Last 7 days — revenue and active riders</p>
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
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRiders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                  cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
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

      {/* Secondary Stats */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-5">
          <CardTitle className="text-base font-semibold">All Metrics</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y divide-border/30">
            {secondaryStats.map((item) => (
              <div key={item.label} className="px-4 py-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold text-foreground">{String(item.value ?? '-')}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions & Activity Stack */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Recent Transactions */}
          <Card
            className="rounded-2xl border-border/50 shadow-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => setActiveSection('transactions')}
          >
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-primary" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="px-6">Rider</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                        No recent transactions
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-semibold px-6">
                          {tx.rider?.fullName || tx.rider?.name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-sm font-bold ${tx.type === 'CREDIT' || tx.type === 'TOP_UP' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                          >
                            {tx.type === 'CREDIT' || tx.type === 'TOP_UP' ? '+' : '-'}
                            {formatINR(tx.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-md text-[10px] font-bold ${
                              tx.status === 'SUCCESS' || tx.status === 'APPROVED'
                                ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                                : 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400'
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-xs text-muted-foreground">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Tickets */}
          <Card
            className="rounded-2xl border-border/50 shadow-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => setActiveSection('tickets')}
          >
            <CardHeader className="pb-3 px-6 pt-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Latest Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="px-6">Ticket ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="pr-6 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                        All clear! No open support tickets.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-mono text-xs px-6 opacity-60">
                          #{ticket.ticketId}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate group">
                          <span className="text-sm font-medium">{ticket.subject}</span>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {ticket.category}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div
                            className={`w-2 h-2 rounded-full ${ticket.priority === 'CRITICAL' ? 'bg-rose-500 ring-4 ring-rose-500/20' : ticket.priority === 'HIGH' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          />
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold rounded-sm ${
                              ticket.status === 'OPEN'
                                ? 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400'
                                : ticket.status === 'IN_PROGRESS'
                                  ? 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400'
                                  : ticket.status === 'RESOLVED'
                                    ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                                    : 'border-border text-muted-foreground bg-muted/30'
                            }`}
                          >
                            {ticket.status.replace('_', ' ')}
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

        {/* Activity Feed Sidebar */}
        <div className="lg:col-span-4">
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Activity Stream
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold text-muted-foreground"
              >
                Live
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4 space-y-6">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-10 opacity-40">
                      <Clock className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  ) : (
                    auditLogs.map((log, i) => {
                      const actorName = log.actorId
                        ? adminNames.get(log.actorId) || `Admin ${log.actorId.slice(-4)}`
                        : 'System';
                      return (
                        <div key={log.id} className="relative pl-6 pb-2">
                          {i !== auditLogs.length - 1 && (
                            <div className="absolute left-[7px] top-[14px] bottom-0 w-[2px] bg-border/40" />
                          )}
                          <div
                            className={`absolute left-0 top-[2px] w-[16px] h-[16px] rounded-full border-4 border-background shadow-sm ${
                              log.action.includes('delete')
                                ? 'bg-rose-500'
                                : log.action.includes('update')
                                  ? 'bg-primary'
                                  : 'bg-emerald-500'
                            }`}
                          />
                          <div className="space-y-1">
                            <p className="text-xs font-bold leading-none tracking-tight">
                              {log.action
                                .split('.')
                                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.entity}{' '}
                              <span className="font-mono text-[10px] opacity-70">
                                #{log.entityId.slice(-6)}
                              </span>
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px] rounded-sm opacity-80"
                              >
                                {actorName}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground/80 italic">
                                {new Date(log.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Health Dialog */}
      <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {healthLoading ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : (
              healthChecks.map((check) => {
                const StatusIcon =
                  check.status === 'ok'
                    ? CheckCircle2
                    : check.status === 'warn'
                      ? AlertTriangle
                      : XCircle;
                const statusColor =
                  check.status === 'ok'
                    ? 'text-emerald-600'
                    : check.status === 'warn'
                      ? 'text-amber-600'
                      : 'text-rose-600';
                const statusBg =
                  check.status === 'ok'
                    ? 'bg-emerald-500/5'
                    : check.status === 'warn'
                      ? 'bg-amber-500/5'
                      : 'bg-rose-500/5';
                return (
                  <div
                    key={check.name}
                    className={`flex items-center justify-between rounded-lg border p-3 ${statusBg}`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                      <div>
                        <p className="text-sm font-semibold">{check.name}</p>
                        <p className="text-xs text-muted-foreground">{check.detail}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs uppercase ${statusColor}`}>
                      {check.status}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
