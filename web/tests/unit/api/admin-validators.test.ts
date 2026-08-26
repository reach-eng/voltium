/**
 * PR-26 (API N1) — Admin validator schema tests.
 *
 * For every schema in `web/src/lib/validators/admin.ts` we assert:
 *  1. A valid input parses successfully.
 *  2. An unknown field is rejected (`.strict()`).
 *  3. A required field missing is rejected.
 *
 * The system-settings `isSecret` case is the API N2 finding from
 * `docs/AUDIT_API_2026-08-03.md` — a caller that sends `isSecret: true`
 * must be rejected.
 */
import { describe, it, expect } from 'vitest';
import {
  dataDeletionRequestSchema,
  dataDeletionApproveSchema,
  dataDeletionRejectSchema,
  dataDeletionRestoreSchema,
  adminRiderUpdateSchema,
  adminWalletAdjustSchema,
  createAdminSchema,
  updateAdminSchema,
  updateFeatureFlagSchema,
  updateSystemSettingSchema,
  createFaqAdminSchema,
  updateFaqAdminSchema,
  updateLegalAdminSchema,
  updateSettingsAdminSchema,
} from '@/lib/validators/admin';

describe('dataDeletionRequestSchema', () => {
  it('accepts valid input', () => {
    expect(
      dataDeletionRequestSchema.safeParse({ riderId: 'r-1', reason: 'GDPR request' }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      dataDeletionRequestSchema.safeParse({ riderId: 'r-1', reason: 'GDPR', sneaky: 'x' }).success
    ).toBe(false);
  });
  it('rejects missing required reason', () => {
    expect(dataDeletionRequestSchema.safeParse({ riderId: 'r-1' }).success).toBe(false);
  });
});

describe('dataDeletionApproveSchema', () => {
  it('accepts valid input', () => {
    expect(
      dataDeletionApproveSchema.safeParse({ requestId: 'req-1', notes: 'ok' }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      dataDeletionApproveSchema.safeParse({ requestId: 'req-1', foo: 1 }).success
    ).toBe(false);
  });
  it('rejects missing required requestId', () => {
    expect(dataDeletionApproveSchema.safeParse({ notes: 'ok' }).success).toBe(false);
  });
});

describe('dataDeletionRejectSchema', () => {
  it('accepts valid input', () => {
    expect(
      dataDeletionRejectSchema.safeParse({
        requestId: 'req-1',
        reason: 'Active lease, please close first.',
      }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      dataDeletionRejectSchema.safeParse({
        requestId: 'req-1',
        reason: 'Active lease, please close first.',
        extra: true,
      }).success
    ).toBe(false);
  });
  it('rejects too-short reason', () => {
    expect(
      dataDeletionRejectSchema.safeParse({ requestId: 'req-1', reason: 'no' }).success
    ).toBe(false);
  });
});

describe('dataDeletionRestoreSchema', () => {
  it('accepts valid input', () => {
    expect(
      dataDeletionRestoreSchema.safeParse({ requestId: 'req-1', reason: 'Restoring per appeal' })
        .success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      dataDeletionRestoreSchema.safeParse({ requestId: 'req-1', reason: 'ok', bogus: 1 }).success
    ).toBe(false);
  });
  it('rejects missing reason', () => {
    expect(dataDeletionRestoreSchema.safeParse({ requestId: 'req-1' }).success).toBe(false);
  });
});

describe('adminRiderUpdateSchema', () => {
  it('accepts valid partial input', () => {
    expect(adminRiderUpdateSchema.safeParse({ fullName: 'New Name' }).success).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      adminRiderUpdateSchema.safeParse({ fullName: 'X', isSuperuser: true }).success
    ).toBe(false);
  });
  it('accepts empty object (all optional)', () => {
    expect(adminRiderUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe('adminWalletAdjustSchema', () => {
  it('accepts valid CREDIT input', () => {
    expect(
      adminWalletAdjustSchema.safeParse({
        type: 'CREDIT',
        amount: 100,
        reason: 'refund',
        proofUrl: 'https://example.com/r.jpg',
      }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      adminWalletAdjustSchema.safeParse({
        type: 'CREDIT',
        amount: 100,
        sneaky: 'x',
      }).success
    ).toBe(false);
  });
  it('rejects non-positive amount', () => {
    expect(
      adminWalletAdjustSchema.safeParse({ type: 'CREDIT', amount: 0 }).success
    ).toBe(false);
  });
});

describe('createAdminSchema', () => {
  it('accepts valid input', () => {
    expect(
      createAdminSchema.safeParse({
        name: 'Ada',
        email: 'ada@voltium.app',
        password: 'correcthorse',
      }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      createAdminSchema.safeParse({
        name: 'Ada',
        email: 'ada@voltium.app',
        password: 'correcthorse',
        isSuperAdmin: true,
      }).success
    ).toBe(false);
  });
  it('rejects short password', () => {
    expect(
      createAdminSchema.safeParse({
        name: 'Ada',
        email: 'ada@voltium.app',
        password: 'short',
      }).success
    ).toBe(false);
  });
});

describe('updateAdminSchema', () => {
  it('accepts valid partial input with id', () => {
    expect(
      updateAdminSchema.safeParse({ id: 'adm-1', name: 'New Name' }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      updateAdminSchema.safeParse({ id: 'adm-1', isSuperuser: true }).success
    ).toBe(false);
  });
  it('rejects missing id', () => {
    expect(updateAdminSchema.safeParse({ name: 'New Name' }).success).toBe(false);
  });
});

describe('updateFeatureFlagSchema', () => {
  it('accepts valid input', () => {
    expect(
      updateFeatureFlagSchema.safeParse({ key: 'enableChatSupport', value: 'true' }).success
    ).toBe(true);
  });
  it('rejects unknown field (e.g. isSecret)', () => {
    expect(
      updateFeatureFlagSchema.safeParse({
        key: 'enableChatSupport',
        value: 'true',
        isSecret: true,
      }).success
    ).toBe(false);
  });
  it('rejects unknown key', () => {
    expect(
      updateFeatureFlagSchema.safeParse({ key: 'enableFlyingCars', value: 'true' }).success
    ).toBe(false);
  });
});

describe('updateSystemSettingSchema (N2: isSecret must be rejected)', () => {
  it('accepts valid input', () => {
    expect(
      updateSystemSettingSchema.safeParse({ key: 'APP_PUBLIC_URL', value: 'https://x' })
        .success
    ).toBe(true);
  });
  it('rejects unknown field — specifically isSecret (audit N2)', () => {
    const result = updateSystemSettingSchema.safeParse({
      key: 'BACKUP_FREQUENCY',
      value: 'daily',
      isSecret: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hasUnrecognized = result.error.issues.some(
        (i) => i.code === 'unrecognized_keys'
      );
      expect(hasUnrecognized).toBe(true);
    }
  });
  it('rejects missing value', () => {
    expect(updateSystemSettingSchema.safeParse({ key: 'APP_PUBLIC_URL' }).success).toBe(false);
  });
});

describe('createFaqAdminSchema', () => {
  it('accepts valid input', () => {
    expect(
      createFaqAdminSchema.safeParse({
        question: 'How do I reset my password?',
        answer: 'Tap profile > settings > reset password.',
      }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      createFaqAdminSchema.safeParse({
        question: 'How do I reset my password?',
        answer: 'Tap profile > settings > reset password.',
        isInternal: true,
      }).success
    ).toBe(false);
  });
  it('rejects short question', () => {
    expect(
      createFaqAdminSchema.safeParse({ question: 'why', answer: 'because' }).success
    ).toBe(false);
  });
});

describe('updateFaqAdminSchema', () => {
  it('accepts valid partial input with id', () => {
    expect(
      updateFaqAdminSchema.safeParse({ id: 'faq-1', question: 'Updated?' }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      updateFaqAdminSchema.safeParse({ id: 'faq-1', hidden: true }).success
    ).toBe(false);
  });
  it('rejects missing id', () => {
    expect(updateFaqAdminSchema.safeParse({ question: 'Updated?' }).success).toBe(false);
  });
});

describe('updateLegalAdminSchema', () => {
  it('accepts valid input', () => {
    expect(
      updateLegalAdminSchema.safeParse({ type: 'terms', content: 'Lorem ipsum' }).success
    ).toBe(true);
  });
  it('rejects unknown field', () => {
    expect(
      updateLegalAdminSchema.safeParse({
        type: 'terms',
        content: 'Lorem',
        hidden: true,
      }).success
    ).toBe(false);
  });
  it('rejects invalid type', () => {
    expect(
      updateLegalAdminSchema.safeParse({ type: 'cookies', content: 'Lorem' }).success
    ).toBe(false);
  });
});

describe('updateSettingsAdminSchema', () => {
  it('accepts valid key/value object', () => {
    expect(
      updateSettingsAdminSchema.safeParse({ walletMinTopup: '100' }).success
    ).toBe(true);
  });
  it('rejects unknown setting key (e.g. isAdmin)', () => {
    // The record() in zod treats this as an extra key, but the
    // .refine() catches it. Either way the parse must fail.
    expect(updateSettingsAdminSchema.safeParse({ isAdmin: 'true' }).success).toBe(false);
  });
  it('rejects empty object', () => {
    expect(updateSettingsAdminSchema.safeParse({}).success).toBe(false);
  });
});
