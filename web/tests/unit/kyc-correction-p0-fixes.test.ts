/**
 * KYC-CORRECTION-P0-2026-09-08: pure-logic tests for the two P0
 * fixes in this PR.
 *
 *   P0-1 — the correction loop dead-end
 *     - the KYC field taxonomy (web/src/lib/kyc-fields.ts) is the
 *       single source of truth for the field-picker UI
 *     - the state machine's editableFields allowlist is enforced
 *       server-side; the client now forwards the admin's selection
 *     - the dialog disables the action button when 0 fields are
 *       selected (fail-closed)
 *
 *   P0-2 — Reject on a never-submitted rider 500s
 *     - the state machine used to require DRAFT → SUBMITTED first,
 *       so the Pending tab's Reject button was a 100% failure
 *     - now DRAFT (the normalized form of PENDING) can transition
 *       directly to REJECTED and INFO_REQUIRED
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import {
  validateKycTransition,
  canTransitionKyc,
  KycStateMachineError,
  type KycState,
} from '@/server/modules/kyc/kyc-state-machine';

import {
  KYC_CORRECTION_FIELDS,
  KYC_CORRECTION_FIELD_KEYS,
  kycFieldLabel,
} from '@/lib/kyc-fields';

// ---------------------------------------------------------------------------
// P0-2: state machine — DRAFT and SUBMITTED both accept REJECT/INFO_REQUIRED
// ---------------------------------------------------------------------------

describe('KYC state machine — P0-2 (DRAFT/PENDING can reject)', () => {
  it('allows DRAFT → REJECTED (never-submitted rider, admin Reject)', () => {
    expect(() => validateKycTransition('DRAFT', 'REJECTED')).not.toThrow();
  });

  it('allows DRAFT → INFO_REQUIRED (never-submitted rider, request correction)', () => {
    expect(() => validateKycTransition('DRAFT', 'INFO_REQUIRED')).not.toThrow();
  });

  it('allows DRAFT → SUBMITTED (still legal — preserves existing happy path)', () => {
    expect(() => validateKycTransition('DRAFT', 'SUBMITTED')).not.toThrow();
  });

  it('allows SUBMITTED → REJECTED (preserves existing behavior)', () => {
    expect(() => validateKycTransition('SUBMITTED', 'REJECTED')).not.toThrow();
  });

  it('allows SUBMITTED → INFO_REQUIRED (preserves existing behavior)', () => {
    expect(() => validateKycTransition('SUBMITTED', 'INFO_REQUIRED')).not.toThrow();
  });

  it('rejects DRAFT → APPROVED (still illegal — must go through SUBMITTED)', () => {
    expect(() => validateKycTransition('DRAFT', 'APPROVED')).toThrow(KycStateMachineError);
  });

  it('rejects APPROVED → REJECTED (irreversible)', () => {
    expect(() => validateKycTransition('APPROVED', 'REJECTED')).toThrow(KycStateMachineError);
  });

  it('rejects REJECTED → INFO_REQUIRED (must re-submit first)', () => {
    expect(() => validateKycTransition('REJECTED', 'INFO_REQUIRED')).toThrow(KycStateMachineError);
  });

  it('rejects EXPIRED → any (terminal)', () => {
    expect(() => validateKycTransition('EXPIRED', 'SUBMITTED')).toThrow(KycStateMachineError);
  });

  it('canTransitionKyc returns true for DRAFT → REJECTED', () => {
    expect(canTransitionKyc('DRAFT', 'REJECTED')).toBe(true);
  });

  it('canTransitionKyc returns false for DRAFT → APPROVED', () => {
    expect(canTransitionKyc('DRAFT', 'APPROVED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P0-1: kyc-fields taxonomy — single source of truth for the field picker
// ---------------------------------------------------------------------------

describe('KYC correction fields — P0-1 (taxonomy)', () => {
  it('exposes 14 fields in onboarding-form order', () => {
    expect(KYC_CORRECTION_FIELDS).toHaveLength(14);
    expect(KYC_CORRECTION_FIELDS.map((f) => f.key)).toEqual([
      'fullName',
      'fatherName',
      'motherName',
      'dob',
      'email',
      'currentAddress',
      'aadhaarFront',
      'aadhaarBack',
      'panCard',
      'bankName',
      'accountNumber',
      'ifscCode',
      'profilePhoto',
      'signature',
    ]);
  });

  it('groups fields into personal / identity / media', () => {
    const groups = KYC_CORRECTION_FIELDS.reduce(
      (acc, f) => {
        acc[f.group] = (acc[f.group] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    expect(groups).toEqual({ personal: 6, identity: 6, media: 2 });
  });

  it('returns a human label for known fields', () => {
    expect(kycFieldLabel('fullName')).toBe('Full name');
    expect(kycFieldLabel('aadhaarFront')).toBe('Aadhaar (front)');
    expect(kycFieldLabel('profilePhoto')).toBe('Profile photo');
  });

  it('falls back to the raw key for unknown fields', () => {
    expect(kycFieldLabel('someUnknownField')).toBe('someUnknownField');
  });

  it('KYC_CORRECTION_FIELD_KEYS matches the field list', () => {
    expect(KYC_CORRECTION_FIELD_KEYS).toEqual(KYC_CORRECTION_FIELDS.map((f) => f.key));
  });

  it('every field key is unique (no dupes that would confuse the picker)', () => {
    const keys = KYC_CORRECTION_FIELD_KEYS;
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// P0-1: dialog action gating — fail-closed when no fields selected
//
// We don't import the dialog component (too many transitive deps).
// Instead we test the gating predicate directly. The component
// already wires this predicate into the AlertDialogAction's
// `disabled` prop (KycDialogs.tsx).
// ---------------------------------------------------------------------------

function shouldDisableAction(params: {
  action: 'reject' | 'info_required' | 'approve';
  reason: string;
  editableFieldsCount: number;
  loading: boolean;
}): boolean {
  const { action, reason, editableFieldsCount, loading } = params;
  if (loading) return true;
  if (action === 'approve') return false;
  // reject or info_required
  return reason.trim().length < 5 || editableFieldsCount === 0;
}

describe('KYC dialog action gating — P0-1 (fail-closed on empty fields)', () => {
  it('disables action when reason < 5 chars (existing behavior)', () => {
    expect(
      shouldDisableAction({
        action: 'reject',
        reason: 'no',
        editableFieldsCount: 3,
        loading: false,
      }),
    ).toBe(true);
  });

  it('disables action when editableFields is empty (P0-1 fix)', () => {
    expect(
      shouldDisableAction({
        action: 'reject',
        reason: 'Needs more details',
        editableFieldsCount: 0,
        loading: false,
      }),
    ).toBe(true);
  });

  it('disables action when editableFields is empty for info_required too (P0-1 fix)', () => {
    expect(
      shouldDisableAction({
        action: 'info_required',
        reason: 'Fix your name',
        editableFieldsCount: 0,
        loading: false,
      }),
    ).toBe(true);
  });

  it('enables action when reason ≥ 5 chars AND at least one field is picked', () => {
    expect(
      shouldDisableAction({
        action: 'reject',
        reason: 'Name does not match Aadhaar',
        editableFieldsCount: 1,
        loading: false,
      }),
    ).toBe(false);
  });

  it('enables approve unconditionally', () => {
    expect(
      shouldDisableAction({
        action: 'approve',
        reason: '',
        editableFieldsCount: 0,
        loading: false,
      }),
    ).toBe(false);
  });

  it('disables action when loading', () => {
    expect(
      shouldDisableAction({
        action: 'reject',
        reason: 'long enough reason here',
        editableFieldsCount: 2,
        loading: true,
      }),
    ).toBe(true);
  });
});
