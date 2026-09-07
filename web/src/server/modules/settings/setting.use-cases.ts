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
        // P2-8 (review, 2026-09-07): a corrupt DB row can carry
        // `value = 'NaN'` or `value = 'undefined'` and turn
        // `Number(value)` into `NaN`; `paiseToRupees(NaN)` then
        // serializes to `null` in the admin UI. Guard with
        // `Number.isFinite` and fall back to the registry default
        // so a corrupt row is visible (the default appears in the
        // response) rather than silently zero-ing the displayed
        // value. Same shape as the existing P0-3 branch on STRING
        // settings.
        const n = Number(value);
        displayMap[key] = Number.isFinite(n) ? String(paiseToRupees(n)) : (meta.defaultValue);
      } else {
        displayMap[key] = value;
      }
    }

    return { settings: displayMap, featureFlags: flags };
  },

  async update(data: Record<string, unknown>, actorId: string) {
    const results: Array<{ id: string; key: string; value: string; updatedAt: Date }> = [];

    // P2-7 (review, 2026-09-07): the previous version recorded
    // `details: { keys: Object.keys(data) }` — the audit log listed
    // the keys that changed but not the before/after values, so a
    // malicious or erroneous change was unauditable. We now capture
    // `old` and `new` per key; values for `isSecret` keys are
    // redacted to the literal marker `[REDACTED]` so the audit
    // log records that a secret changed (which is itself
    // important to know) without recording the secret itself.
    const auditChanges: Array<{ key: string; old: string; new: string }> = [];

    // Coerce and validate all items first before performing upserts
    const coercedEntries: Array<{
      key: string;
      stored: string;
      valueType: string;
      category: string;
      isSecret: boolean;
      oldValue: string;
    }> = [];
    for (const [key, value] of Object.entries(data)) {
      // P1-6 (2026-09-07): honor isEditable on the SHARED system_settings
      // table. The two admin settings surfaces now agree on frozen rows:
      // PUT /api/admin/system-settings already refuses !isEditable, but this
      // business path (multi-key, rupees-in) ignored it — an OPERATIONS_ADMIN
      // could edit a key the operator froze against SUPER_ADMIN too.
      //
      // P2-7: also pull the current `value` and `isSecret` so the
      // audit log can record the before/after diff.
      const existing = await db.systemSetting.findUnique({
        where: { key },
        select: { value: true, isEditable: true, isSecret: true },
      });
      if (existing && existing.isEditable === false) {
        throw new Error(`Setting ${key} is read-only`);
      }

      const { stored, valueType } = coerceSettingValue(key, value);
      // P2-18/P3-19: the route's schema allowlists keys, but the use-case must
      // not crash with a raw 500 if ever called with a registry-missing key
      // (P3-20 — a key inserted directly into the DB is not in the registry).
      const meta = SETTINGS_BY_KEY.get(key);
      if (!meta) {
        throw new Error(`Unknown setting key: ${key}`);
      }
      // Registry-declared isSecret wins over the DB row's isSecret
      // when they disagree — the registry is the canonical source
      // for "what's secret". The DB row's isSecret is a legacy
      // column kept for the existing system-settings surface.
      const isSecret = meta.isSecret ?? existing?.isSecret ?? false;
      coercedEntries.push({
        key,
        stored,
        valueType,
        category: meta.category,
        isSecret,
        // `oldValue` is the previously-persisted value if any, else
        // the registry default (matches what `getAll` would render
        // before the upsert). Either way, the audit log can answer
        // "what changed from the rider's point of view".
        oldValue: existing?.value ?? meta.defaultValue,
      });
    }

    for (const item of coercedEntries) {
      const meta = SETTINGS_BY_KEY.get(item.key);
      const result = await db.systemSetting.upsert({
        where: { key: item.key },
        // P0-5 (2026-09-07): isSecret/isEditable are server-owned row
        // metadata on the SHARED system_settings table — the system-settings
        // surface masks on isSecret and refuses PUTs on !isEditable rows.
        // Hardcoding `isSecret: false, isEditable: true` here permanently
        // un-froze any row this flow touched (the route's key allowlist
        // governs WHICH keys, not metadata overwrites). Update now writes
        // value/type/category only. On first-time create, metadata comes
        // from the registry (defaults: non-secret, editable).
        update: {
          value: item.stored,
          valueType: item.valueType,
          category: item.category,
        },
        create: {
          key: item.key,
          value: item.stored,
          valueType: item.valueType,
          category: item.category,
          isSecret: meta?.isSecret ?? false,
          isEditable: meta?.isEditable ?? true,
        },
      });
      results.push(result);

      // P2-7: only record a change entry when the value actually
      // changed. Same-value upserts are a no-op audit-wise; including
      // them would inflate the log on idempotent retries.
      if (item.oldValue !== item.stored) {
        auditChanges.push({
          key: item.key,
          old: item.isSecret ? '[REDACTED]' : item.oldValue,
          new: item.isSecret ? '[REDACTED]' : item.stored,
        });
      }
    }

    createAuditLog({
      actorId,
      action: 'settings.update',
      entity: 'settings',
      entityId: 'global',
      // P2-7: log the actual before/after values per key (or
      // `[REDACTED]` for `isSecret` keys). Only changed keys are
      // included. The empty `changes` array on a no-op update is
      // also fine — the audit row still records WHO called the
      // action and WHEN, which is enough to attribute the no-op.
      details: { changes: auditChanges },
    }).catch(() => {});

    return results;
  },

  async getPublic() {
    const settings = await db.systemSetting.findMany({
      where: { key: { in: PUBLIC_SETTING_KEYS } },
    });

    // RIDER-SETTINGS-2026-09-07 (P3-6): seed the response with
    // defaults from `DEFAULT_SETTINGS_MAP` for every public key so a
    // fresh or seedless DB still exposes the public settings the
    // rider app needs (supportEmail, supportPhone, walletMinTopup,
    // etc.). DB rows override the defaults so admin edits take
    // effect. Same pattern as `getAll` above (line 17).
    //
    // P0-3 (2026-09-07): STRING settings (supportEmail, supportPhone)
    // branch on the registry's valueType instead of forcing them
    // through Number() (which would NaN them to null).
    const settingsMap: Record<string, number | string> = {};
    for (const key of PUBLIC_SETTING_KEYS) {
      const meta = SETTINGS_BY_KEY.get(key);
      if (!meta || !meta.isPublic) continue;
      const defaultValue = DEFAULT_SETTINGS_MAP[key];
      if (defaultValue === undefined) continue;
      if (meta.valueType === 'STRING') {
        settingsMap[key] = defaultValue;
      } else if (meta.category === 'BUSINESS') {
        settingsMap[key] = paiseToRupees(Number(defaultValue));
      } else {
        settingsMap[key] = Number(defaultValue);
      }
    }
    for (const s of settings) {
      const meta = SETTINGS_BY_KEY.get(s.key);
      if (meta && meta.isPublic) {
        if (meta.valueType === 'STRING') {
          settingsMap[s.key] = s.value;
        } else if (meta.category === 'BUSINESS') {
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
