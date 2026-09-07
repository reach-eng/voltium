import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { settingUseCases } from '@/server/modules/settings/setting.use-cases';
import {
  PUBLIC_SETTING_KEYS,
  SETTINGS_BY_KEY,
  DEFAULT_SETTINGS_MAP,
  type SettingMetadata,
} from '@/server/modules/settings/settings.registry';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    // P1-6: update() now reads isEditable before upserting.
    systemSetting: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() }
  }
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({ flagA: true })
}));

describe('Setting Use Cases - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // P1-6: default all rows to editable so existing tests keep their
    // semantics; the P1-6 describe block overrides per-test.
    (db.systemSetting.findUnique as any).mockResolvedValue({ isEditable: true });
  });

  it('getAll returns default settings blended with db settings and feature flags', async () => {
    (db.systemSetting.findMany as any).mockResolvedValue([
      { key: 'walletMinTopup', value: '200000' }
    ]);
    
    const result = await settingUseCases.getAll();
    // Assuming walletMinTopup is a monetary key and paiseToRupees divides by 100
    // Actually the logic does String(paiseToRupees(Number(value)))
    expect(result.settings.walletMinTopup).toBeDefined();
    expect((result.featureFlags as any).flagA).toBe(true);
  });

  // P1-6 (2026-09-07): the two admin settings surfaces must agree on frozen
  // rows. PUT /api/admin/system-settings already refuses !isEditable; the
  // business path ignored it. Now update() throws, the route maps it to 400,
  // and nothing is written.
  describe('P1-6 isEditable honored across surfaces', () => {
    it('refuses to write a frozen row and never reaches the upsert', async () => {
      (db.systemSetting.findUnique as any).mockResolvedValue({ isEditable: false });
      (db.systemSetting.upsert as any).mockResolvedValue({});

      await expect(
        settingUseCases.update({ walletMinTopup: '2000' }, 'actor-1')
      ).rejects.toThrow(/is read-only/);

      expect(db.systemSetting.upsert).not.toHaveBeenCalled();
    });

    it('still writes editable rows (findUnique returns editable or missing)', async () => {
      (db.systemSetting.upsert as any).mockResolvedValue({});

      // Row missing entirely (first-time create).
      (db.systemSetting.findUnique as any).mockResolvedValueOnce(null);
      await settingUseCases.update({ lateFee: '150' }, 'actor-1');
      expect(db.systemSetting.upsert).toHaveBeenCalledTimes(1);

      // Row present and editable.
      (db.systemSetting.findUnique as any).mockResolvedValueOnce({ isEditable: true });
      await settingUseCases.update({ lateFee: '150' }, 'actor-1');
      expect(db.systemSetting.upsert).toHaveBeenCalledTimes(2);
    });
  });

  it('update upserts correctly', async () => {
    (db.systemSetting.upsert as any).mockResolvedValue({});
    const result = await settingUseCases.update({ lateFee: '500' }, 'actor-1');
    expect(db.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'lateFee' },
      // P0-5 (2026-09-07): update writes value/type/category ONLY —
      // isSecret/isEditable are server-owned row metadata that must survive
      // business-settings edits.
      update: { value: '50000', valueType: 'NUMBER', category: 'BUSINESS' },
      // First-time create takes metadata from the registry. lateFee has no
      // explicit meta → defaults (non-secret, editable).
      create: { key: 'lateFee', value: '50000', valueType: 'NUMBER', category: 'BUSINESS', isSecret: false, isEditable: true },
    });
    expect(result).toEqual([{}]);
  });

  // P0-5 regression: business-settings update() used to hardcode
  // isSecret: false / isEditable: true on BOTH upsert branches, permanently
  // un-froze and un-secreted any row it touched on the shared
  // system_settings table (the system-settings surface masks on isSecret
  // and refuses PUTs on !isEditable rows).
  describe('P0-5 metadata preservation', () => {
    const FAKE_KEY = '__p0_5_probe__';

    afterEach(() => {
      SETTINGS_BY_KEY.delete(FAKE_KEY);
    });

    it('never writes isSecret/isEditable on update', async () => {
      (db.systemSetting.upsert as any).mockResolvedValue({});

      await settingUseCases.update({ walletMinTopup: '2000' }, 'actor-1');

      const call = (db.systemSetting.upsert as any).mock.calls[0][0];
      expect(call.update).not.toHaveProperty('isSecret');
      expect(call.update).not.toHaveProperty('isEditable');
    });

    it('derives create metadata from the registry meta when present', async () => {
      SETTINGS_BY_KEY.set(FAKE_KEY, {
        key: FAKE_KEY,
        category: 'POLICY',
        valueType: 'STRING',
        defaultValue: '',
        isPublic: false,
        description: 'P0-5 probe',
        isSecret: true,
        isEditable: false,
      });
      (db.systemSetting.upsert as any).mockResolvedValue({});

      await settingUseCases.update({ [FAKE_KEY]: 'x' }, 'actor-1');

      const call = (db.systemSetting.upsert as any).mock.calls[0][0];
      expect(call.create).toMatchObject({ key: FAKE_KEY, isSecret: true, isEditable: false });
      // …while update stays metadata-free regardless.
      expect(call.update).not.toHaveProperty('isSecret');
      expect(call.update).not.toHaveProperty('isEditable');
    });

    it('defaults create metadata to non-secret/editable when meta omits them', async () => {
      (db.systemSetting.upsert as any).mockResolvedValue({});

      await settingUseCases.update({ referralBonus: '700' }, 'actor-1');

      const call = (db.systemSetting.upsert as any).mock.calls[0][0];
      expect(call.create.isSecret).toBe(false);
      expect(call.create.isEditable).toBe(true);
    });
  });

  // P0-3 (2026-09-07): getPublic used to force every non-BUSINESS value
  // through Number(), so STRING settings (supportEmail, supportPhone)
  // serialized as null. These tests pin the response contract per key.
  describe('getPublic — P0-3 value-type contract', () => {
    function seedAllPublicSettings() {
      (db.systemSetting.findMany as any).mockResolvedValue(
        PUBLIC_SETTING_KEYS.map((key) => ({ key, value: DEFAULT_SETTINGS_MAP[key] }))
      );
    }

    it('returns STRING settings as strings (not NaN → null)', async () => {
      seedAllPublicSettings();

      const { settings } = await settingUseCases.getPublic();

      expect(settings.supportEmail).toBe(DEFAULT_SETTINGS_MAP.supportEmail);
      expect(settings.supportPhone).toBe(DEFAULT_SETTINGS_MAP.supportPhone);
      expect(typeof settings.supportEmail).toBe('string');
      expect(typeof settings.supportPhone).toBe('string');
    });

    it('pins the runtime type of every public key against the registry', async () => {
      seedAllPublicSettings();

      const { settings } = await settingUseCases.getPublic();

      for (const key of PUBLIC_SETTING_KEYS) {
        const meta = SETTINGS_BY_KEY.get(key);
        expect(meta, `registry metadata for ${key}`).toBeDefined();
        const value = settings[key];
        if (meta!.valueType === 'STRING') {
          expect(typeof value, `${key} must be a string`).toBe('string');
        } else {
          expect(typeof value, `${key} must be a number`).toBe('number');
          expect(Number.isFinite(value as number), `${key} must be finite`).toBe(true);
        }
      }
      // Every requested key must come back — no silent drops.
      expect(Object.keys(settings).sort()).toEqual([...PUBLIC_SETTING_KEYS].sort());
    });

    it('converts BUSINESS numbers paise→rupees and passes other numbers through', async () => {
      seedAllPublicSettings();

      const { settings } = await settingUseCases.getPublic();

      // walletMinTopup default is 150000 paise → 1500 rupees
      expect(settings.walletMinTopup).toBe(1500);
      // gpsFetchIntervalMins is LOCATION (not BUSINESS) — plain number, no /100
      expect(settings.gpsFetchIntervalMins).toBe(10);
    });
  });

  // P3-6 (2026-09-07): when the DB has no rows for the public keys
  // (fresh/seedless environment), `getPublic` must fall back to the
  // registry defaults via `DEFAULT_SETTINGS_MAP` so the rider app
  // still gets `supportEmail`, `supportPhone`, etc. Otherwise the
  // response is `{}` and the rider app's support-contact card
  // resolves to null.
  describe('getPublic — P3-6 empty-DB defaults fallback', () => {
    it('returns registry defaults for every public key when the DB is empty', async () => {
      // No DB rows — `findMany` returns [].
      (db.systemSetting.findMany as any).mockResolvedValue([]);

      const { settings } = await settingUseCases.getPublic();

      // Every public key must come back (no silent drops).
      expect(Object.keys(settings).sort()).toEqual(
        [...PUBLIC_SETTING_KEYS].sort()
      );
      // Each public key has the registry's defaultValue (after the
      // appropriate STRING vs BUSINESS number coercion).
      for (const key of PUBLIC_SETTING_KEYS) {
        const meta = SETTINGS_BY_KEY.get(key)!;
        const expectedRaw = DEFAULT_SETTINGS_MAP[key];
        expect(expectedRaw, `${key} must have a DEFAULT_SETTINGS_MAP entry`).toBeDefined();
        if (meta.valueType === 'STRING') {
          expect(settings[key], `${key} should be the default string`).toBe(expectedRaw);
        } else if (meta.category === 'BUSINESS') {
          // paise → rupees conversion
          expect(settings[key], `${key} should be default in rupees`).toBe(
            Number(expectedRaw) / 100
          );
        } else {
          expect(settings[key], `${key} should be the default number`).toBe(Number(expectedRaw));
        }
      }
    });

    it('DB rows override the defaults', async () => {
      // One row present — its value should win over the default.
      (db.systemSetting.findMany as any).mockResolvedValue([
        { key: 'supportEmail', value: 'custom@voltium.example' },
      ]);

      const { settings } = await settingUseCases.getPublic();

      expect(settings.supportEmail).toBe('custom@voltium.example');
      // The other public keys still come from the defaults.
      expect(settings.supportPhone).toBe(DEFAULT_SETTINGS_MAP.supportPhone);
    });

    it('a public key missing from DEFAULT_SETTINGS_MAP is omitted (not undefined)', async () => {
      // Simulate drift: temporarily remove a public key from
      // DEFAULT_SETTINGS_MAP. The function should NOT leak `undefined`
      // into the response (it skips the key).
      (db.systemSetting.findMany as any).mockResolvedValue([]);
      const original = DEFAULT_SETTINGS_MAP.walletMinTopup;
      delete (DEFAULT_SETTINGS_MAP as any).walletMinTopup;
      try {
        const { settings } = await settingUseCases.getPublic();
        expect('walletMinTopup' in settings).toBe(false);
        // Other keys are still seeded from defaults.
        expect(settings.supportEmail).toBe(DEFAULT_SETTINGS_MAP.supportEmail);
      } finally {
        DEFAULT_SETTINGS_MAP.walletMinTopup = original;
      }
    });
  });
});
