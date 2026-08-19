import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PR-3 (2026-08-06 fix plan) — the middleware's maintenance state cache is
 * now a shared module with an explicit invalidate. Before, the admin PUT
 * route could not clear the 5s in-memory cache, so a toggle took up to 5s
 * to reach the rider API. These tests pin the cache semantics.
 */

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: { findUnique: mocks.findUnique },
  },
}));

import {
  getMaintenanceState,
  invalidateMaintenanceCache,
} from '@/lib/maintenance-cache';

describe('maintenance-cache (PR-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    invalidateMaintenanceCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    invalidateMaintenanceCache();
  });

  it('reads the DB on first call and caches within the TTL', async () => {
    mocks.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === 'MAINTENANCE_MODE' ? { value: 'true' } : { value: 'Down for upgrade' }
    );

    const first = await getMaintenanceState();
    expect(first.enabled).toBe(true);
    expect(first.message).toBe('Down for upgrade');
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);

    // Second call within 5s TTL: served from cache, no new DB reads.
    mocks.findUnique.mockClear();
    const second = await getMaintenanceState();
    expect(second.enabled).toBe(true);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('invalidateMaintenanceCache forces a fresh DB read', async () => {
    mocks.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === 'MAINTENANCE_MODE' ? { value: 'true' } : { value: 'Up' }
    );
    await getMaintenanceState();

    // Admin toggles maintenance off → cache dropped.
    invalidateMaintenanceCache();
    mocks.findUnique.mockClear();
    mocks.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === 'MAINTENANCE_MODE' ? { value: 'false' } : { value: 'Up' }
    );

    const after = await getMaintenanceState();
    expect(after.enabled).toBe(false);
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  it('fails open (enabled=false) when the DB read throws', async () => {
    mocks.findUnique.mockRejectedValue(new Error('db down'));
    const state = await getMaintenanceState();
    expect(state.enabled).toBe(false);
  });
});
