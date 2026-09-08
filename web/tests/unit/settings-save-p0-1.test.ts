import { describe, it, expect } from 'vitest';
import {
  mergeServerSettings,
  buildDirtyPayload,
} from '@/components/admin/screens/settings/useSettings';
import {
  DEFAULT_SETTINGS,
  type Settings,
} from '@/components/admin/screens/settings/settingsTypes';

/**
 * P0-1 regression tests — Business Settings save was broken end-to-end.
 *
 * The hook used to spread the API envelope (`{ settings, featureFlags }`)
 * over the flat defaults, so every card showed defaults instead of server
 * values, and `saveSettings` PUT the junk keys (`settings`, `featureFlags`)
 * which `updateSettingsAdminSchema` rejects → every save 400'd.
 */

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

describe('P0-1 mergeServerSettings', () => {
  it('unwraps the { settings, featureFlags } envelope instead of spreading it', () => {
    const envelope = {
      settings: { walletMinTopup: '2000', lateFee: '150' },
      featureFlags: { newDashboard: true },
    };

    const merged = mergeServerSettings(envelope);

    // Server values must land on the flat keys…
    expect(merged.walletMinTopup).toBe('2000');
    expect(merged.lateFee).toBe('150');
    // …and the junk envelope keys must never enter state.
    expect((merged as unknown as Record<string, unknown>)['settings']).toBeUndefined();
    expect((merged as unknown as Record<string, unknown>)['featureFlags']).toBeUndefined();
  });

  it('keeps every key a string and fills gaps with defaults', () => {
    const merged = mergeServerSettings({
      walletMinTopup: '2500',
      supportEmail: 'help@voltium.in',
      // non-string / unknown keys are ignored
      maxRentalDays: 42,
      notARealKey: 'x',
    });

    expect(merged.walletMinTopup).toBe('2500');
    expect(merged.supportEmail).toBe('help@voltium.in');
    expect(merged.maxRentalDays).toBe(DEFAULT_SETTINGS.maxRentalDays);
    expect(KEYS.every((k) => typeof merged[k] === 'string')).toBe(true);
  });

  it('falls back to defaults for empty/missing payloads', () => {
    expect(mergeServerSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeServerSettings({})).toEqual(DEFAULT_SETTINGS);
  });
});

describe('P0-1 buildDirtyPayload', () => {
  const serverState = (): Settings => ({
    ...DEFAULT_SETTINGS,
    walletMinTopup: '2000',
    lateFee: '150',
  });

  it('emits only keys that differ from initial', () => {
    const initial = serverState();
    const current = { ...initial, lateFee: '175', referralBonus: '600' };

    expect(buildDirtyPayload(current, initial)).toEqual({
      lateFee: '175',
      referralBonus: '600',
    });
  });

  it('returns an empty object when nothing changed', () => {
    const s = serverState();
    expect(buildDirtyPayload(s, s)).toEqual({});
  });

  it('never includes keys outside the Settings allowlist (schema safety)', () => {
    // Simulate junk that once leaked into state via the envelope spread.
    const junk = { ...serverState() } as unknown as Record<string, string>;
    junk['settings'] = '{"walletMinTopup":"2000"}';
    junk['featureFlags'] = '[object Object]';

    const initial = serverState();
    const current = { ...initial, walletMinTopup: '3000' } as unknown as Record<
      string,
      string
    >;
    current['settings'] = '{"walletMinTopup":"3000"}';

    const payload = buildDirtyPayload(
      current as unknown as Settings,
      initial
    ) as Record<string, string>;

    expect(payload['walletMinTopup']).toBe('3000');
    expect(payload).not.toHaveProperty('settings');
    expect(payload).not.toHaveProperty('featureFlags');
  });

  it('is compatible with updateSettingsAdminSchema (valid keys, non-empty)', async () => {
    const { updateSettingsAdminSchema } = await import('@/lib/validators/admin');
    const initial = serverState();
    const current = { ...initial, supportEmail: 'care@voltium.in' };

    const payload = buildDirtyPayload(current, initial);
    const result = updateSettingsAdminSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  // P1-4: the audited mass-overwrite scenario. After a failed GET the hook
  // leaves state == initial == DEFAULT_SETTINGS; the admin edits one field;
  // the PUT body must contain ONLY that field — never the 13 untouched
  // defaults. (Combined with the loadError Save-block in the hook/UI, the
  // save-after-failed-load path is also blocked outright.)
  it('P1-4: after a failed load, editing one field PUTs only that field', () => {
    const failedLoadState = mergeServerSettings(undefined); // == DEFAULT_SETTINGS
    const afterEdit = { ...failedLoadState, lateFee: '250' };

    expect(buildDirtyPayload(afterEdit, failedLoadState)).toEqual({
      lateFee: '250',
    });
  });
});
