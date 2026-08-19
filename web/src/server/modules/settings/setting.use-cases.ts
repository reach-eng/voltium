import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { getFeatureFlags } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';
import {
  SETTING_REGISTRY,
  SETTINGS_BY_KEY,
  DEFAULT_SETTINGS_MAP,
  PUBLIC_SETTING_KEYS,
  coerceSettingValue,
} from './settings.registry';

export const settingUseCases = {
  async getAll() {
    const [flags, settings] = await Promise.all([getFeatureFlags(), db.systemSetting.findMany()]);

    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS_MAP };
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const displayMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(settingsMap)) {
      const meta = SETTINGS_BY_KEY.get(key);
      if (meta && meta.category === 'BUSINESS' && meta.valueType === 'NUMBER') {
        displayMap[key] = String(paiseToRupees(Number(value)));
      } else {
        displayMap[key] = value;
      }
    }

    return { settings: displayMap, featureFlags: flags };
  },

  async update(data: Record<string, unknown>, actorId: string) {
    const results: Array<{ id: string; key: string; value: string; updatedAt: Date }> = [];

    // Coerce and validate all items first before performing upserts
    const coercedEntries: Array<{ key: string; stored: string; valueType: string; category: string }> = [];
    for (const [key, value] of Object.entries(data)) {
      const { stored, valueType } = coerceSettingValue(key, value);
      // P2-18/P3-19: the route's schema allowlists keys, but the use-case must
      // not crash with a raw 500 if ever called with a registry-missing key
      // (P3-20 — a key inserted directly into the DB is not in the registry).
      const meta = SETTINGS_BY_KEY.get(key);
      if (!meta) {
        throw new Error(`Unknown setting key: ${key}`);
      }
      coercedEntries.push({ key, stored, valueType, category: meta.category });
    }

    for (const item of coercedEntries) {
      const result = await db.systemSetting.upsert({
        where: { key: item.key },
        update: {
          value: item.stored,
          valueType: item.valueType,
          category: item.category,
          // P3-20: isSecret/isEditable are server-owned metadata — the
          // allowlist in the route (and the registry guard above) prevents a
          // malicious admin from flipping a read-only setting to editable.
          isSecret: false,
          isEditable: true,
        },
        create: {
          key: item.key,
          value: item.stored,
          valueType: item.valueType,
          category: item.category,
          isSecret: false,
          isEditable: true,
        },
      });
      results.push(result);
    }

    createAuditLog({
      actorId,
      action: 'settings.update',
      entity: 'settings',
      entityId: 'global',
      details: { keys: Object.keys(data) },
    }).catch(() => {});

    return results;
  },

  async getPublic() {
    const settings = await db.systemSetting.findMany({
      where: { key: { in: PUBLIC_SETTING_KEYS } },
    });

    const settingsMap: Record<string, number> = {};
    for (const s of settings) {
      const meta = SETTINGS_BY_KEY.get(s.key);
      if (meta && meta.isPublic) {
        if (meta.category === 'BUSINESS' && meta.valueType === 'NUMBER') {
          settingsMap[s.key] = paiseToRupees(Number(s.value));
        } else {
          settingsMap[s.key] = Number(s.value);
        }
      }
    }

    const flags = await getFeatureFlags();
    return { settings: settingsMap, featureFlags: flags };
  },
};
