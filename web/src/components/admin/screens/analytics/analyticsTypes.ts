/**
 * R3.7c — type definitions and pure helpers for the Analytics Dashboard.
 * Extracted from AnalyticsDashboard.tsx so the data hook and the UI
 * components can share types without circular imports.
 */

export interface AnalyticsOverview {
  totalRiders: number;
  activeRiders: number;
  currentMRR: number;
  mrrGrowth: number;
  avgRevenuePerRider: number;
  churnRate: number;
  collectionEfficiency: number;
  totalVehicles: number;
  activeVehicles: number;
}

export interface AnalyticsTrend {
  month: string;
  revenue: number;
}

export interface AnalyticsCohort {
  month: string;
  total: number;
  active: number;
  suspended: number;
  retentionRate: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  trend: AnalyticsTrend[];
  cohorts: AnalyticsCohort[];
}

export const POLL_INTERVAL_MS = 60_000;

/** Format a number as Indian Rupees (no fraction digits, e.g. ₹1,234). */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a "YYYY-MM" month string as a compact chart label (e.g. "Mar 26"). */
export function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
