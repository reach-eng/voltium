/**
 * TG-6 (2026-08-05 ops audit) — updateFeatureFlag writes valueType from the
 * flag's runtime type. Previously hardcoded 'BOOLEAN', so maxUploadSizeMb (a
 * NUMBER flag) was persisted as a boolean — the DB lied about the type and
 * any query/migration bucketing by valueType would corrupt numeric flags.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findMany: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/db', () => ({
  db: { systemSetting: { upsert: mocks.upsert, findMany: mocks.findMany } },
}));

import { updateFeatureFlag, getAllFeatureFlags } from '@/lib/feature-flags';

describe('TG-6: updateFeatureFlag valueType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockResolvedValue({});
    mocks.findMany.mockResolvedValue([]);
  });

  it('writes BOOLEAN for boolean flags', async () => {
    await updateFeatureFlag('enableReferralSystem', 'true');
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'flag.enableReferralSystem' },
        update: expect.objectContaining({ value: 'true', valueType: 'BOOLEAN' }),
        create: expect.objectContaining({ value: 'true', valueType: 'BOOLEAN' }),
      })
    );
  });

  it('writes NUMBER for maxUploadSizeMb', async () => {
    await updateFeatureFlag('maxUploadSizeMb', '50');
    const call = mocks.upsert.mock.calls[0][0];
    expect(call.update.valueType).toBe('NUMBER');
    expect(call.create.valueType).toBe('NUMBER');
    expect(call.update.value).toBe('50');
  });

  it('returns true on success and false on DB error', async () => {
    mocks.upsert.mockResolvedValue({});
    expect(await updateFeatureFlag('enableOfflineMode', 'true')).toBe(true);

    mocks.upsert.mockRejectedValue(new Error('db down'));
    expect(await updateFeatureFlag('enableOfflineMode', 'true')).toBe(false);
  });

  it('getAllFeatureFlags includes valueType for boolean and number flags', async () => {
    const flags = await getAllFeatureFlags();
    expect(flags.enableReferralSystem.valueType).toBe('BOOLEAN');
    expect(flags.maxUploadSizeMb.valueType).toBe('NUMBER');
  });
});
