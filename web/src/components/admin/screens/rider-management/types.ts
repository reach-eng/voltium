/**
 * R3.7cc split — Rider Management types & filter constants.
 *
 * The canonical Rider shape lives in `@/lib/types/admin` (single source
 * of truth) — we re-export it here so the rider-management modules
 * don't have to reach into lib/types for every import.
 */

import type { Rider } from '@/lib/types/admin';

export type { Rider } from '@/lib/types/admin';

export type KycStatus =
  | 'APPROVED'
  | 'REJECTED'
  | 'INFO_REQUIRED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'VERIFIED';

export type RiderState =
  | 'NEW'
  | 'KYC_SUBMITTED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CLOSED'
  | 'APPROVED'
  | 'POST_ACTIVE'
  | 'PRE_ACTIVE'
  | 'ONBOARDING';

export type KycActionKind = 'approve' | 'reject' | 'info_required';

export const STATE_FILTERS = [
  'ALL',
  'NEW',
  'KYC_SUBMITTED',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
] as const;

export const KYC_FILTERS = [
  'ALL',
  'APPROVED',
  'REJECTED',
  'INFO_REQUIRED',
  'PENDING',
] as const;

export const RIDER_PERMISSIONS: { key: keyof Rider; label: string }[] = [
  { key: 'locationGranted', label: 'Location' },
  { key: 'batteryGranted', label: 'Battery' },
  { key: 'contactsGranted', label: 'Contacts' },
  { key: 'callLogsGranted', label: 'Call Logs' },
  { key: 'micGranted', label: 'Microphone' },
  { key: 'cameraGranted', label: 'Camera' },
  { key: 'phoneGranted', label: 'Phone' },
];

export const RIDER_PAGE_SIZE = 20;

export interface ConfirmKycState {
  rider: Rider;
  action: KycActionKind;
}

export interface LastBulkAction {
  ids: string[];
  previousStates: Record<string, { state: string; accountStatus: string }>;
  action: string;
}

export function getStateBadge(state: string): string {
  const styles: Record<string, string> = {
    APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    VERIFIED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    POST_ACTIVE:
      'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    PRE_ACTIVE: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    REJECTED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    SUSPENDED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    ONBOARDING:
      'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  };
  return (
    styles[state] ||
    'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
  );
}

export function getKycBadge(status: string): string {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
    case 'VERIFIED':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'REJECTED':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    case 'INFO_REQUIRED':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'PENDING':
    case 'SUBMITTED':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}
