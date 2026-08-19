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

export { RiderLifecycleStatus } from '@prisma/client';

export type RiderState =
  | 'NEW'
  | 'PHONE_VERIFIED'
  | 'PROFILE_SUBMITTED'
  | 'KYC_SUBMITTED'
  | 'KYC_APPROVED'
  | 'GUARANTOR_SUBMITTED'
  | 'GUARANTOR_APPROVED'
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_APPROVED'
  | 'PLAN_SELECTED'
  | 'PICKUP_SCHEDULED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'RETURN_PENDING'
  | 'CLOSED';

export type KycActionKind = 'approve' | 'reject' | 'info_required';

export const STATE_FILTERS = [
  'ALL',
  'NEW',
  'PHONE_VERIFIED',
  'PROFILE_SUBMITTED',
  'KYC_SUBMITTED',
  'KYC_APPROVED',
  'GUARANTOR_SUBMITTED',
  'GUARANTOR_APPROVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_APPROVED',
  'PLAN_SELECTED',
  'PICKUP_SCHEDULED',
  'ACTIVE',
  'SUSPENDED',
  'RETURN_PENDING',
  'CLOSED',
] as const;

export const KYC_FILTERS = [
  'ALL',
  'PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'INFO_REQUIRED',
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


