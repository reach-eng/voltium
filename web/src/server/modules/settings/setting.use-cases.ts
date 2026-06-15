import { db } from '@/lib/db';
import { paiseToRupees, rupeesToPaise } from '@/lib/flatten-rider';
import { getFeatureFlags } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';

const MONETARY_KEYS = new Set(['dailyRent', 'weeklyRent', 'monthlyRent', 'securityDeposit', 'walletMinTopup', 'lateFee', 'referralBonus']);
const PUBLIC_SETTINGS = ['securityDeposit', 'walletMinTopup', 'lateFee', 'referralBonus'];

export const settingUseCases = {
  async getAll() {
    const [flags, settings] = await Promise.all([getFeatureFlags(), db.setting.findMany()]);

    const DEFAULT_SETTINGS: Record<string, string> = {
      dailyRent: '29900', weeklyRent: '149900', monthlyRent: '499900',
      securityDeposit: '150000', walletMinTopup: '150000', lateFee: '10000', referralBonus: '20000',
      autoApproveKYC: 'false', gracePeriodHours: '24', emailNotifications: 'true', smsNotifications: 'true',
    };

    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const s of settings) settingsMap[s.key] = s.value;

    const displayMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(settingsMap)) {
      displayMap[key] = MONETARY_KEYS.has(key) ? String(paiseToRupees(Number(value))) : value;
    }

    return { settings: displayMap, featureFlags: flags };
  },

  async update(data: Record<string, unknown>, actorId: string) {
    const results: Array<{ id: string; key: string; value: string; updatedAt: Date }> = [];
    for (const [key, value] of Object.entries(data)) {
      let storedValue = String(value);
      if (MONETARY_KEYS.has(key)) storedValue = String(rupeesToPaise(Number(value)));
      const result = await db.setting.upsert({ where: { key }, update: { value: storedValue }, create: { key, value: storedValue } });
      results.push(result);
    }
    createAuditLog({ actorId, action: 'settings.update', entity: 'settings', entityId: 'global', details: { keys: Object.keys(data) } }).catch(() => {});
    return results;
  },

  async getPublic() {
    const settings = await db.setting.findMany({ where: { key: { in: PUBLIC_SETTINGS } } });
    const settingsMap: Record<string, number> = {};
    for (const s of settings) settingsMap[s.key] = paiseToRupees(Number(s.value));
    const flags = await getFeatureFlags();
    return { settings: settingsMap, featureFlags: flags };
  },
};
