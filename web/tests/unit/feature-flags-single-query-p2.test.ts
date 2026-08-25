/**
 * P2-21 (2026-08-05 ops audit) — getAllFeatureFlags issued a SECOND findMany
 * just to tag which flags came from the DB, doubling the query on a read-heavy
 * admin screen. getFeatureFlags now caches the raw DB overrides from its own
 * single query, and getAllFeatureFlags overlays them with no extra query.
 *
 * (Standalone file: the real '@/lib/feature-flags' module needs its own
 * module-registry isolation — the route-level tests mock it wholesale.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/db', () => ({
  db: { systemSetting: { findMany: mocks.findMany, upsert: mocks.upsert } },
}));

import { getFeatureFlags, getAllFeatureFlags } from '@/lib/feature-flags';

describe('P2-21: getAllFeatureFlags reuses the single DB query', () => {
  let dbRows: Array<{ key: string; value: string }>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Prisma's upsert takes ONE config object: { where, update, create }.
    mocks.upsert.mockImplementation(async (args: { create: { key: string; value: string } }) => {
      dbRows = dbRows.map((r) =>
        r.key === args.create.key ? { ...r, value: args.create.value } : r
      );
      return {};
    });
    dbRows = [
      { key: 'flag.enableReferralSystem', value: 'false' },
      { key: 'flag.maxUploadSizeMb', value: '25' },
    ];
    mocks.findMany.mockReset();
    mocks.findMany.mockImplementation(async () => dbRows);
  });

  it('calls findMany exactly once across getFeatureFlags + getAllFeatureFlags', async () => {
    const fresh = await import('@/lib/feature-flags');
    await fresh.getFeatureFlags();
    const result = await fresh.getAllFeatureFlags();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(result.enableReferralSystem).toEqual({ value: 'false', source: 'database', valueType: 'BOOLEAN' });
    expect(result.maxUploadSizeMb).toEqual({ value: '25', source: 'database', valueType: 'NUMBER' });
  });

  it('flags not in the DB report source runtime', async () => {
    mocks.findMany.mockResolvedValue([]);
    const fresh = await import('@/lib/feature-flags');
    await fresh.getFeatureFlags();
    const result = await fresh.getAllFeatureFlags();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(result.enableRewardsSystem.source).toBe('runtime');
  });

  it('updateFeatureFlag clears the cached overrides so the next read re-queries', async () => {
    const fresh = await import('@/lib/feature-flags');
    await fresh.getFeatureFlags();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    mocks.findMany.mockClear();

    await fresh.updateFeatureFlag('enableReferralSystem', 'true');
    await fresh.getFeatureFlags();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const result = await fresh.getAllFeatureFlags();
    expect(result.enableReferralSystem).toEqual({ value: 'true', source: 'database', valueType: 'BOOLEAN' });
  });
});
