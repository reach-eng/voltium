import { BRAND_DOMAIN, BRAND_SHORT } from '@/lib/branding';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { formatDashboardDate, transactionDisplayName, type DashboardStats, type RecentTransaction } from './types';

/**
 * R3.7z split — CSV report export. Pure function, side-effect only at
 * the Blob-URL download trigger. Keeps the dashboard shell free of
 * inline CSV string assembly.
 */
export function buildReportCsv(
  stats: DashboardStats,
  recentTransactions: RecentTransaction[]
): string {
  const today = formatDateTimeDDMMYYYY(new Date().toISOString());

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
        `${transactionDisplayName(tx)},${tx.amount},${tx.status},${formatDashboardDate(tx.createdAt)}`
    ),
  ].join('\n');
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
