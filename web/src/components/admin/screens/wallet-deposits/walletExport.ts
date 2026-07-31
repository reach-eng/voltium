import { toast } from 'sonner';
import type { LedgerEntry } from './types';

/**
 * R3.7j split — CSV export for the wallet ledger.
 *
 * Pure function: takes the filtered rows and triggers a browser
 * download of a CSV blob. Quoting follows RFC 4180 (double-quote any
 * field containing comma, newline, or quote; double-up embedded
 * quotes). Toast on success or when the user has no data to export.
 */
export function exportWalletLedger(filtered: LedgerEntry[]): void {
  if (filtered.length === 0) {
    toast.error('No ledger entries available to export');
    return;
  }
  const headers = ['Rider Name', 'Rider ID', 'Type', 'Purpose', 'Amount (INR)', 'Date'];
  const rows = filtered.map((l) => [
    `"${l.riderName.replace(/"/g, '""')}"`,
    `"${l.riderId}"`,
    l.type,
    `"${l.purpose}"`,
    l.amount,
    `"${new Date(l.createdAt).toLocaleString()}"`,
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wallet-ledger-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Wallet ledger exported to CSV successfully');
}
