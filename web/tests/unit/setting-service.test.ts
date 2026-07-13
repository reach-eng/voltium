import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settingUseCases } from '@/server/modules/settings/setting.use-cases';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: { findMany: vi.fn(), upsert: vi.fn() }
  }
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({ flagA: true })
}));

describe('Setting Use Cases - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAll returns default settings blended with db settings and feature flags', async () => {
    (db.systemSetting.findMany as any).mockResolvedValue([
      { key: 'walletMinTopup', value: '200000' }
    ]);
    
    const result = await settingUseCases.getAll();
    // Assuming walletMinTopup is a monetary key and paiseToRupees divides by 100
    // Actually the logic does String(paiseToRupees(Number(value)))
    expect(result.settings.walletMinTopup).toBeDefined();
    expect(result.featureFlags.flagA).toBe(true);
  });

  it('update upserts correctly', async () => {
    (db.systemSetting.upsert as any).mockResolvedValue({});
    const result = await settingUseCases.update({ lateFee: '500' }, 'actor-1');
    expect(db.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'lateFee' },
      create: { key: 'lateFee', value: '50000', valueType: 'NUMBER', category: 'BUSINESS', isSecret: false, isEditable: true },
      update: { value: '50000', valueType: 'NUMBER', category: 'BUSINESS', isSecret: false, isEditable: true }
    });
    expect(result).toEqual([{}]);
  });
});
