import type { ReactNode } from 'react';

/**
 * R3 split (BackgroundJobsScreen) — types & icon helper.
 *
 * JobData + ReconciliationReport were inlined in
 * BackgroundJobsScreen.tsx. Extracted so the data hook, the
 * job card, the reconciliation table, and the report inspector
 * can all share the same view of a job / report row.
 */

export interface JobData {
  id: string;
  name: string;
  schedule: string;
  purpose: string;
  lastRun: string | null;
  lastStatus: string;
  details: string | null;
}

export interface ReconciliationReport {
  id: string;
  reportDate: string;
  totalWallets: number;
  matched: number;
  mismatched: number;
  totalLedgerSum: number;
  totalWalletSum: number;
  drift: number;
  mismatchDetails: string;
  createdAt: string;
}

/** Pick an icon for a job based on its id. */
export function getJobIcon(id: string): ReactNode {
  switch (id) {
    case 'wallet-reconciliation':
      return '🗄️';
    case 'rent-due-checker':
      return '📅';
    case 'auto-debit':
      return '⏰';
    case 'device-compliance':
      return '🛡️';
    case 'referral-reward':
      return '✨';
    case 'notifications-cleanup':
    case 'telemetry-cleanup':
      return '🔄';
    case 'daily-engagement':
      return '🔔';
    default:
      return '▶️';
  }
}

/** Tailwind classes for the job status badge. */
export function getJobStatusBadgeClass(status: string): string {
  if (status === 'SUCCESS') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50';
  }
  if (status === 'FAILED') {
    return 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50';
  }
  return 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-50';
}

/** Human label for the job status badge. */
export function getJobStatusLabel(status: string): string {
  if (status === 'SUCCESS') return '✓ Online';
  if (status === 'FAILED') return '⚠️ Drift Detected';
  return 'Never Run';
}

/** Tailwind classes for the reconciliation-status badge. */
export function getReconStatusBadgeClass(mismatched: number): string {
  return mismatched === 0
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50'
    : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50';
}

/** Human label for the reconciliation-status badge. */
export function getReconStatusLabel(mismatched: number): string {
  return mismatched === 0 ? 'Balanced ✓' : 'Drift Alert ⚠️';
}
