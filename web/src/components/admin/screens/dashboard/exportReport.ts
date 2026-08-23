import { BRAND_DOMAIN, BRAND_SHORT } from '@/lib/branding';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { formatDashboardDate, transactionDisplayName, type DashboardStats, type RecentTransaction } from './types';

/**
 * P1-2 (ADMIN_DASHBOARD_AUDIT_2026-08-24): options for the CSV builder.
 * `redactPii` strips the rider name to a non-reversible initials form
 * for admins who can read the dashboard but should not be able to
 * download a list of full names. The audit log records who exported
 * what and when, so compliance can re-link if a redacted export is
 * investigated.
 */
export interface BuildReportCsvOptions {
  redactPii?: boolean;
}

/**
 * R3.7z split — CSV report export. Pure function, side-effect only at
 * the Blob-URL download trigger. Keeps the dashboard shell free of
 * inline CSV string assembly.
 */
export function buildReportCsv(
  stats: DashboardStats,
  recentTransactions: RecentTransaction[],
  options: BuildReportCsvOptions = {}
): string {
  const today = formatDateTimeDDMMYYYY(new Date().toISOString());
  const { redactPii = false } = options;

  return [
    `${BRAND_SHORT} Dashboard Report`,
    `Generated: ${today}`,
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
        `${redactPii ? redactRiderName(transactionDisplayName(tx)) : transactionDisplayName(tx)},${tx.amount},${tx.status},${formatDashboardDate(tx.createdAt)}`
    ),
  ].join('\n');
}

/**
 * Reduce a full rider name to first-initial + last-initial (e.g.
 * "Ravi Kumar" → "R.K.", "Madhur" → "M."). Falls back to "Rider"
 * for empty strings. Not reversible — the audit log is the canonical
 * source for the unredacted name.
 */
function redactRiderName(fullName: string): string {
  if (!fullName || fullName === 'Unknown') return 'Rider';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Rider';
  if (parts.length === 1) return `${parts[0][0]}.`;
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}.${last}.`;
}

export function downloadReport(csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${BRAND_DOMAIN.split('.')[0]}-report-${formatDateDDMMYYYY(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
