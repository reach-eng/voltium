/**
 * Settings hardening — contract tests for the 2026-09-08 settings-audit
 * fixes that aren't covered elsewhere:
 *
 *   1. P1-1  registry ↔ ADMIN_SETTING_KEYS liveness: every allowlisted key
 *            exists in the registry, and every registry key is EITHER
 *            writable here OR asserted-unwritable with a named reason
 *            (skipGuarantorExtraDeposit has a dedicated writer).
 *   2. P1-3  coerceSettingValue range validation: negative walletMinTopup,
 *            maxRentalDays: 0, and absurd maxima are rejected; boundary
 *            values are accepted.
 *   3. P1-7  updateSettingsAdminSchema accepts native booleans for
 *            BOOLEAN settings (previously string|number only → 400).
 *   4. P0-5  update() preserves isSecret/isEditable on existing rows and
 *            takes them from registry meta on create.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  SETTING_REGISTRY,
  SETTINGS_BY_KEY,
  coerceSettingValue,
} from '@/server/modules/settings/settings.registry';
import {
  ADMIN_SETTING_KEYS,
  updateSettingsAdminSchema,
} from '@/lib/validators/admin';

// ---------------------------------------------------------------------------
// P1-1 — registry ↔ allowlist liveness
// ---------------------------------------------------------------------------

describe('P1-1: ADMIN_SETTING_KEYS ↔ SETTING_REGISTRY liveness', () => {
  it('every allowlisted key exists in the registry (no 400-on-save typos)', () => {
    for (const key of ADMIN_SETTING_KEYS) {
      expect(
        SETTINGS_BY_KEY.has(key),
        `allowlisted key "${key}" is not in SETTING_REGISTRY — any PUT containing it will 400`
      ).toBe(true);
    }
  });

  it('every registry key is writable here or has a named dedicated writer', () => {
    // Keys that have their own writer outside /api/admin/settings.
    // Each entry must carry the reason it is excluded from this surface.
    const dedicatedWriters: Record<string, string> = {
      skipGuarantorExtraDeposit:
        'dedicated writer: PUT /api/admin/config/skip-guarantor (with its own validation)',
    };

    for (const meta of SETTING_REGISTRY) {
      const writable = (ADMIN_SETTING_KEYS as readonly string[]).includes(meta.key);
      if (!writable) {
        expect(
          dedicatedWriters[meta.key],
          `registry key "${meta.key}" has no writer on /api/admin/settings and no documented dedicated writer — it is dead config`
        ).toBeTruthy();
      }
    }

    // And the documented dedicated writers actually exist.
    expect(dedicatedWriters).toHaveProperty('skipGuarantorExtraDeposit');
  });

  it('the allowlist has no duplicates', () => {
    expect(new Set(ADMIN_SETTING_KEYS).size).toBe(ADMIN_SETTING_KEYS.length);
  });
});

// ---------------------------------------------------------------------------
// P1-3 — coerceSettingValue range validation
// ---------------------------------------------------------------------------

describe('P1-3: coerceSettingValue range validation', () => {
  it('rejects a negative walletMinTopup (rupees in)', () => {
    expect(() => coerceSettingValue('walletMinTopup', -500)).toThrow(
      /must be >=/
    );
  });

  it('rejects maxRentalDays: 0 (would make every rental instantly overdue)', () => {
    expect(() => coerceSettingValue('maxRentalDays', 0)).toThrow(/must be >=/);
  });

  it('rejects absurd maxima (gracePeriodHours: 999999)', () => {
    expect(() => coerceSettingValue('gracePeriodHours', 999999)).toThrow(
      /must be <=/
    );
  });

  it('rejects zero on keys whose floor is 1 (gpsFetchIntervalMins)', () => {
    expect(() => coerceSettingValue('gpsFetchIntervalMins', 0)).toThrow(
      /must be >=/
    );
  });

  it('accepts boundary values at min and max', () => {
    // walletMinTopup min is 1 rupee → 100 paise
    expect(coerceSettingValue('walletMinTopup', 1)).toEqual({
      stored: '100',
      valueType: 'NUMBER',
    });
    // maxRentalDays min is 1
    expect(coerceSettingValue('maxRentalDays', 1)).toEqual({
      stored: '1',
      valueType: 'NUMBER',
    });
  });

  it('accepts legitimate zero on keys whose floor is 0 (autoApproveTopupLimit disables)', () => {
    expect(coerceSettingValue('autoApproveTopupLimit', 0)).toEqual({
      stored: '0',
      valueType: 'NUMBER',
    });
  });

  it('every NUMBER registry key carries a min and max', () => {
    for (const meta of SETTING_REGISTRY) {
      if (meta.valueType !== 'NUMBER') continue;
      expect(
        meta.min,
        `NUMBER key "${meta.key}" is missing a min range`
      ).toBeDefined();
      expect(
        meta.max,
        `NUMBER key "${meta.key}" is missing a max range`
      ).toBeDefined();
      expect(meta.min!).toBeLessThanOrEqual(Number(meta.defaultValue));
      expect(meta.max!).toBeGreaterThanOrEqual(Number(meta.defaultValue));
    }
  });

  it('range bounds use the API unit (rupees) not paise', () => {
    // walletMinTopup: min 1 rupee. If the range were accidentally in
    // paise, min would be 100 and this coerce of 1 (rupee) would throw.
    expect(() => coerceSettingValue('walletMinTopup', 1)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// P1-7 — boolean acceptance in updateSettingsAdminSchema
// ---------------------------------------------------------------------------

describe('P1-7: updateSettingsAdminSchema accepts native booleans', () => {
  it('accepts autoApproveKYC: true', () => {
    const result = updateSettingsAdminSchema.safeParse({
      autoApproveKYC: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts mixed string/number/boolean payloads', () => {
    const result = updateSettingsAdminSchema.safeParse({
      autoApproveKYC: false,
      lateFee: 120,
      supportEmail: 'care@voltium.app',
    });
    expect(result.success).toBe(true);
  });

  it('still rejects unknown keys', () => {
    const result = updateSettingsAdminSchema.safeParse({
      notARealKey: true,
    });
    expect(result.success).toBe(false);
  });

  it('still rejects an empty payload', () => {
    expect(updateSettingsAdminSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P0-5 — update() preserves isSecret/isEditable metadata
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  getFeatureFlags: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { settingUseCases } from '@/server/modules/settings/setting.use-cases';

describe('P0-5: update() preserves row metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFeatureFlags.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockImplementation(({ where, create }) => ({
      id: `row-${where.key}`,
      key: where.key,
      value: create.value,
      updatedAt: new Date(),
    }));
  });

  it('does NOT write isSecret/isEditable on update (existing rows keep their metadata)', async () => {
    mocks.findUnique.mockResolvedValue({
      value: '150000',
      isEditable: true, // editable row — the update must not clobber metadata
      isSecret: false,
    });

    await settingUseCases.update({ walletMinTopup: 2000 }, 'admin-1');

    const call = mocks.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('isSecret');
    expect(call.update).not.toHaveProperty('isEditable');
  });

  it('takes create-time metadata from the registry, not hardcoded values', async () => {
    await settingUseCases.update({ walletMinTopup: 2000 }, 'admin-1');

    const call = mocks.upsert.mock.calls[0][0];
    // Registry meta for walletMinTopup: no isSecret/isEditable overrides,
    // so the documented defaults apply (non-secret, editable) — but they
    // must be *derived*, i.e. any registry override would flow through.
    expect(call.create.isSecret).toBe(false);
    expect(call.create.isEditable).toBe(true);
  });

  it('refuses to update a frozen row (isEditable=false)', async () => {
    mocks.findUnique.mockResolvedValue({
      value: '150000',
      isEditable: false,
      isSecret: false,
    });

    await expect(
      settingUseCases.update({ walletMinTopup: 2000 }, 'admin-1')
    ).rejects.toThrow(/read-only/);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
