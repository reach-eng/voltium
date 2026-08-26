/**
 * Admin panel shared types — STUB.
 *
 * The proper consolidated Rider interface is part of Phase 7 Q2 follow-up
 * (Ticket #1 in FOLLOWUP_TICKETS). For now, export a permissive shape
 * that satisfies the existing admin dialog's field access patterns
 * (60+ fields combined from Rider + child tables).
 *
 * Per-screen `interface Rider { ... }` was previously duplicated in
 * 6 admin screens. To unblock the typecheck while the proper extraction
 * ships, this stub matches the original `interface Rider { [key: string]: any }`
 * pattern but with the strict field access preserved for the most-used fields.
 */

export interface Rider {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  [key: string]: any;
}

export type KycStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'VERIFIED';

export type RiderLifecycleStage =
  | 'NEW'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'RETURN_PENDING'
  | 'CLOSED';

export interface RiderEditForm {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  fatherName: string;
  motherName: string;
  dob: string;
  intent: string;
  emergencyContact: string;
  currentAddress: string;
  lifecycleStatus: string;
  [key: string]: any;
}
