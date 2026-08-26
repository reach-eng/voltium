import {
  AlertTriangle,
  Bike,
  CalendarDays,
  Clock,
  IndianRupee,
  MessageSquare,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * R3.7z split — Dashboard types & display config.
 */

export interface TrendPoint {
  date: string;
  revenue: number;
  riders: number;
}

export interface DashboardStats {
  totalRiders: number;
  activeRiders: number;
  totalVehicles: number;
  availableVehicles: number;
  totalBalance: number;
  totalDeposits: number;
  totalRevenue?: number;
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

export interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  purpose: string;
  status: string;
  createdAt: string;
  rider?: { fullName: string | null; name: string | null; riderId: string };
}

export interface RecentTicket {
  id: string;
  ticketId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  rider?: { fullName: string | null; name: string | null; riderId: string };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorId: string | null;
  details: unknown;
  createdAt: string;
}

export interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  latencyMs: number;
  detail: string;
}

export interface StatCardConfig {
  key: keyof DashboardStats;
  label: string;
  icon: LucideIcon;
  route: string;
  format?: 'inr' | 'number';
}

export const DASHBOARD_POLL_INTERVAL_MS = 30_000;

export const STAT_CARDS: StatCardConfig[] = [
  { key: 'activeRiders', label: 'Active Riders', icon: Users, route: 'riders' },
  { key: 'availableVehicles', label: 'Available Fleet', icon: Bike, route: 'vehicles' },
  {
    key: 'totalRevenue',
    label: 'Total Revenue',
    icon: IndianRupee,
    route: 'transactions',
    format: 'inr',
  },
  {
    key: 'totalBalance',
    label: 'Wallet Float',
    icon: IndianRupee,
    route: 'wallet',
    format: 'inr',
  },
  {
    key: 'totalDeposits',
    label: 'Deposits Held',
    icon: ShieldAlert,
    route: 'transactions',
    format: 'inr',
  },
  {
    key: 'pendingTransactions',
    label: 'Pending Payouts',
    icon: Clock,
    route: 'transactions',
  },
  { key: 'pendingKyc', label: 'KYC Backlog', icon: AlertTriangle, route: 'kyc' },
  { key: 'openTickets', label: 'Open Tickets', icon: MessageSquare, route: 'tickets' },
  { key: 'activeRentals', label: 'Active Rentals', icon: CalendarDays, route: 'rentals' },
];

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDashboardDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLogTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function transactionDisplayName(tx: RecentTransaction): string {
  return tx.rider?.fullName || tx.rider?.name || 'Unknown';
}
