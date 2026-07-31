/**
 * Settings Use Cases
 *
 * Backed by the SETTING_REGISTRY (./settings.registry.ts) as the single
 * source of truth for what settings exist, their types, defaults, and
 * which are public to the rider app.
 *
 * The use-case is intentionally thin: it just mediates DB reads/writes
 * and applies the registry's validation/coercion. Adding a new setting
 * should not require changes to this file — only to the registry.
 */

import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { getFeatureFlags } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';
import {
  SETTING_REGISTRY,
  DEFAULT_SETTINGS_MAP,
  PUBLIC_SETTING_KEYS,
  coerceSettingValue,
  type SettingMeta,
} from './settings.registry';
import { ValidationError } from "@/lib/api-error";

export const settingUseCases = {
  /**
   * Returns ALL registered settings with their effective values
   * (DB-stored value, or registry default if absent). Monetary values
   * are converted from paise → rupees for display.
   */
  async getAll() {
    const [flags, settings] = await Promise.all([
      getFeatureFlags(),
      db.systemSetting.findMany(),
    ]);

    // Start with the registry defaults, then layer DB rows on top.
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS_MAP };
    for (const s of settings) settingsMap[s.key] = s.value;

    const displayMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(settingsMap)) {
      const meta = SETTING_REGISTRY.find((s) => s.key === key);
      const isMonetary = meta?.category === 'BUSINESS' && meta?.valueType === 'NUMBER';
      displayMap[key] = isMonetary ? String(paiseToRupees(Number(value))) : value;
    }

    return { settings: displayMap, featureFlags: flags };
  },

  /**
   * Upsert a batch of settings. Validates each key against the registry
   * and coerces the value to the declared type. Throws on unknown key
   * or wrong type — caller is expected to surface a 400.
   */
  async update(data: Record<string, unknown>, actorId: string) {
    const results: Array<{ id: string; key: string; value: string; updatedAt: Date }> = [];
    for (const [key, rawValue] of Object.entries(data)) {
      // validate + coerce via registry
      const { stored, valueType } = coerceSettingValue(key, rawValue);
      const meta: SettingMeta | undefined = SETTING_REGISTRY.find((s) => s.key === key);
      if (!meta) {
        // coerceSettingValue already throws on unknown key; this is unreachable.
        throw new ValidationError(`Unknown setting key: ${key}`);
      }

      const result = await db.systemSetting.upsert({
        where: { key },
        update: {
          value: stored,
          valueType,
          category: meta.category,
          isSecret: false,
          isEditable: true,
        },
        create: {
          key,
          value: stored,
          valueType,
          category: meta.category,
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

  /**
   * Returns only the public settings (those flagged isPublic in the
   * registry). Monetary values are converted from paise → rupees.
   */
  async getPublic() {
    const settings = await db.systemSetting.findMany({
      where: { key: { in: [...PUBLIC_SETTING_KEYS] } },
    });
    const settingsMap: Record<string, number> = {};
    for (const s of settings) {
      const meta = SETTING_REGISTRY.find((m) => m.key === s.key);
      const isMonetary = meta?.category === 'BUSINESS' && meta?.valueType === 'NUMBER';
      settingsMap[s.key] = isMonetary ? paiseToRupees(Number(s.value)) : Number(s.value);
    }
    const flags = await getFeatureFlags();
    return { settings: settingsMap, featureFlags: flags };
  },
};
