import { BRAND_DOMAIN, BRAND_SHORT } from '@/lib/branding';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { formatDashboardDate, transactionDisplayName, type DashboardStats, type RecentTransaction } from './types';

/**
 * RFC-4180 field escape + formula-injection guard: wrap in quotes if
 * needed, double interior quotes, and prefix-escape cells whose (trimmed)
 * start is `= + - @` (or tab/CR) — Excel/Sheets trim leading whitespace
 * before evaluating, so ` =cmd` is live too. Rider-controlled text
 * (e.g. display names) must never execute as a formula.
 */
function csvEscape(field: string | number | null | undefined): string {
  let s = String(field ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

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
    // P2: the export covers only the polled rows — say so in the file.
    `Scope: latest ${recentTransactions.length} transactions (screen snapshot, not full history)`,
    '',
    'Key Metrics',
    `Active Riders,${csvEscape(stats.activeRiders)}`,
    `Available Vehicles,${csvEscape(stats.availableVehicles)}`,
    `Total Revenue,${csvEscape(stats.totalRevenue ?? 0)}`,
    `Wallet Float,${csvEscape(stats.totalBalance)}`,
    `Deposits Held,${csvEscape(stats.totalDeposits)}`,
    `Pending Transactions,${csvEscape(stats.pendingTransactions)}`,
    `Open Tickets,${csvEscape(stats.openTickets)}`,
    `Active Rentals,${csvEscape(stats.activeRentals)}`,
    `Pending KYC,${csvEscape(stats.pendingKyc)}`,
    `Pending Guarantor,${csvEscape(stats.pendingGuarantor)}`,
    '',
    'Recent Transactions',
    'Rider,Amount,Status,Date',
    ...recentTransactions.map(
      (tx) =>
        `${csvEscape(transactionDisplayName(tx))},${csvEscape(tx.amount)},${csvEscape(tx.status)},${csvEscape(formatDashboardDate(tx.createdAt))}`
    ),
  ].join('\n');
}

export function downloadReport(csv: string): void {
  // P2: UTF-8 BOM so Excel renders ₹ (and other non-ASCII) correctly
  // instead of mojibake.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${BRAND_DOMAIN.split('.')[0]}-report-${formatDateDDMMYYYY(new Date().toISOString())}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay revoke to allow download to start on Firefox/Safari.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
