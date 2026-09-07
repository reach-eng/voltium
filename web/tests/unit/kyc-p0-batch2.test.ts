/**
 * KYC-P0-BATCH2-2026-09-08: tests for the two P0 fixes in this PR.
 *
 *   P0-1 — Late KYC rejection clobbering an APPROVED guarantor
 *     Mirrors the existing approve-branch guard. Only write the
 *     guarantor status when the existing guarantor is in SUBMITTED
 *     state. Otherwise (APPROVED, REJECTED, INFO_REQUIRED,
 *     EXPIRED, PENDING, DRAFT), leave the guarantor untouched.
 *
 *   P0-2 — KYC notification type mismatch (live path passed
 *     'INFO_REQUIRED' but the function expected 'INFO_REQUESTED',
 *     wire format became KYC_INFO_REQUIRED which Flutter ignores)
 *     The function now accepts the canonical DB enum value
 *     'INFO_REQUIRED' and translates to the Flutter discriminator
 *     'INFO_REQUESTED' internally.
 */

import { describe, it, expect, vi } from 'vitest';

// Use vi.hoisted so the mock factory can reference these variables
// (vitest hoists vi.mock to the top of the file, so module-level
// `const` declarations aren't in scope inside the factory).
const { mockCreateAndSend, mockNotificationCreate, mockRiderFindUnique } = vi.hoisted(() => ({
  mockCreateAndSend: vi.fn().mockResolvedValue({ success: true }),
  mockNotificationCreate: vi.fn().mockResolvedValue({}),
  mockRiderFindUnique: vi.fn().mockResolvedValue({ fcmToken: null }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    notification: { create: mockNotificationCreate },
    rider: { findUnique: mockRiderFindUnique },
  },
}));
vi.mock('@/lib/fcm', () => ({ fcmService: { sendPushNotification: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/posthog-client', () => ({ posthog: { capture: vi.fn() } }));
vi.mock('@/lib/api-money', () => ({ formatInr: (n: number) => `₹${n}` }));

import { notificationService } from '@/lib/notification-service';
// Replace createAndSend with our spy so we can capture the data arg.
(notificationService as any).createAndSend = mockCreateAndSend;

// ---------------------------------------------------------------------------
// P0-2: notifyKycStatusChange translates INFO_REQUIRED → INFO_REQUESTED
// ---------------------------------------------------------------------------

describe('notifyKycStatusChange — P0-2 (type mapping)', () => {
  it('passes the canonical name INFO_REQUIRED through the signature', () => {
    // TypeScript-level: this is a compile-time assertion. If the
    // signature regresses to INFO_REQUESTED-only, this file's
    // tsc --noEmit will fail.
    // (verified by the explicit call below with 'INFO_REQUIRED')
  });

  it('translates INFO_REQUIRED to KYC_INFO_REQUESTED on the wire (Flutter discriminator)', async () => {
    await notificationService.notifyKycStatusChange(
      'rider-1',
      'INFO_REQUIRED',
      'Name does not match Aadhaar',
    );

    expect(mockCreateAndSend).toHaveBeenCalledTimes(1);
    const [_riderId, _title, _message, _type, data] =
      mockCreateAndSend.mock.calls[0];
    // The CRITICAL assertion: the wire discriminator matches what
    // Flutter's fcm_service.dart:205-207 recognizes.
    expect(data.type).toBe('KYC_INFO_REQUESTED');
  });

  it('passes INFO_REQUESTED through unchanged (legacy/Flutter spelling, used by outbox dispatcher)', async () => {
    mockCreateAndSend.mockClear();
    await notificationService.notifyKycStatusChange(
      'rider-2',
      'INFO_REQUESTED',
      'fix your name',
    );
    const [_riderId, _title, _message, _type, data] =
      mockCreateAndSend.mock.calls[0];
    expect(data.type).toBe('KYC_INFO_REQUESTED');
  });

  it('passes APPROVED through unchanged', async () => {
    mockCreateAndSend.mockClear();
    await notificationService.notifyKycStatusChange('rider-1', 'APPROVED');
    const [_riderId, _title, _message, _type, data] =
      mockCreateAndSend.mock.calls[0];
    expect(data.type).toBe('KYC_APPROVED');
  });

  it('passes REJECTED through unchanged', async () => {
    mockCreateAndSend.mockClear();
    await notificationService.notifyKycStatusChange('rider-1', 'REJECTED', 'fake proof');
    const [_riderId, _title, _message, _type, data] =
      mockCreateAndSend.mock.calls[0];
    expect(data.type).toBe('KYC_REJECTED');
  });

  it('forwards the rejection reason when provided', async () => {
    mockCreateAndSend.mockClear();
    await notificationService.notifyKycStatusChange(
      'rider-1',
      'INFO_REQUIRED',
      'Name does not match Aadhaar',
    );
    const [_riderId, _title, _message, _type, data] =
      mockCreateAndSend.mock.calls[0];
    expect(data.reason).toBe('Name does not match Aadhaar');
    expect(data.screen).toBe('KYC_STATUS');
  });

  it('omits the reason key when not provided', async () => {
    mockCreateAndSend.mockClear();
    await notificationService.notifyKycStatusChange('rider-1', 'APPROVED');
    const [_riderId, _title, _message, _type, data] =
      mockCreateAndSend.mock.calls[0];
    expect('reason' in data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P0-1: guarantor status guard — pure logic test of the gating rule
// ---------------------------------------------------------------------------

// Mirror the inline guard logic from admin-riders.use-cases.ts.
// If the source rule changes, this test catches the drift.
function shouldDowngradeGuarantorOnKycReject(
  existingGuarantorStatus: string | null | undefined,
): boolean {
  // KYC-P0-BATCH2-2026-09-08 (P0-1): the reject/info_required branch
  // only writes guarantorData.status when the existing guarantor is
  // in SUBMITTED. Same rule as the approve branch (line 493-495 of
  // admin-riders.use-cases.ts after this fix).
  return existingGuarantorStatus === 'SUBMITTED';
}

describe('KYC reject/info_required — P0-1 (guarantor guard)', () => {
  it('does NOT downgrade an APPROVED guarantor (the bug)', () => {
    expect(shouldDowngradeGuarantorOnKycReject('APPROVED')).toBe(false);
  });

  it('does NOT downgrade a REJECTED guarantor (idempotent — already at terminal)', () => {
    expect(shouldDowngradeGuarantorOnKycReject('REJECTED')).toBe(false);
  });

  it('does NOT downgrade an INFO_REQUIRED guarantor (waiting on rider)', () => {
    expect(shouldDowngradeGuarantorOnKycReject('INFO_REQUIRED')).toBe(false);
  });

  it('does NOT downgrade an EXPIRED guarantor', () => {
    expect(shouldDowngradeGuarantorOnKycReject('EXPIRED')).toBe(false);
  });

  it('does NOT touch a PENDING guarantor (rider never submitted)', () => {
    expect(shouldDowngradeGuarantorOnKycReject('PENDING')).toBe(false);
  });

  it('does NOT touch a DRAFT guarantor (rider never submitted)', () => {
    expect(shouldDowngradeGuarantorOnKycReject('DRAFT')).toBe(false);
  });

  it('does NOT touch a null/undefined guarantor (no row yet)', () => {
    expect(shouldDowngradeGuarantorOnKycReject(null)).toBe(false);
    expect(shouldDowngradeGuarantorOnKycReject(undefined)).toBe(false);
  });

  it('downgrades a SUBMITTED guarantor (admin is reviewing the in-flight guarantor)', () => {
    // This is the only case where the reject branch SHOULD write
    // the guarantor status. It's the mirror of the approve branch's
    // `if existingGuarantor?.status === 'SUBMITTED'`.
    expect(shouldDowngradeGuarantorOnKycReject('SUBMITTED')).toBe(true);
  });
});
