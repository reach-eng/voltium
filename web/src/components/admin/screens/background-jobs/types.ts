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
  lastError?: string | null;
  nextRun?: string | null;
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
  // WEB-AUDIT 2026-08-14 P0-2: the previous version returned
  // light-mode pastel pills (`bg-emerald-50 text-emerald-700
  // border-emerald-100`). In dark mode these render as bright
  // pastel pills on a dark card — high-contrast but the wrong
  // family. Switch to the established dark-aware pattern
  // (border-X-500/20 text-X-600 bg-X-500/5 dark:text-X-400) used
  // elsewhere in the admin.
  if (status === 'SUCCESS') {
    return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 hover:bg-emerald-500/10';
  }
  if (status === 'FAILED') {
    return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400 hover:bg-rose-500/10';
  }
  return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400 hover:bg-slate-500/10';
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
    ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 hover:bg-emerald-500/10'
    : 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400 hover:bg-rose-500/10';
}

/** Human label for the reconciliation-status badge. */
export function getReconStatusLabel(mismatched: number): string {
  return mismatched === 0 ? 'Balanced ✓' : 'Drift Alert ⚠️';
}
