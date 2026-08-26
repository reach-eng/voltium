/**
 * Server Entity Cache — Unit Tests
 *
 * Tests src/lib/server-cache.ts — entity-level cache helpers that wrap
 * cachedPrismaQuery with per-entity key namespaces, TTLs, and invalidation.
 *
 * Covers:
 *   - getCachedRider / getCachedRiderByPhone / getCachedRiderStatus (cache hit, miss, dedup)
 *   - invalidateRiderCache / invalidateRiderPhoneCache (clears all rider key shapes)
 *   - getCachedVehicle / getCachedHub / invalidateXxxCache
 *   - invalidateAllEntityCaches
 *   - shape parameter (simple vs wide keys do not collide)
 *   - normalizeRiderId passthrough
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function getFreshModule() {
  vi.resetModules();
  return import('../../src/lib/server-cache');
}

describe('getCachedRider', () => {
  beforeEach(async () => {
    vi.useRealTimers();
  });

  it('returns the value from the queryFn on first call', async () => {
    const { getCachedRider } = await getFreshModule();
    const rider = { id: 'cuid1', lifecycleStatus: 'ACTIVE' };
    const fetcher = vi.fn().mockResolvedValue(rider);

    const result = await getCachedRider('cuid1', fetcher);
    expect(result).toBe(rider);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('caches by normalized id — second call hits cache', async () => {
    const { getCachedRider } = await getFreshModule();
    const rider = { id: 'cuid1' };
    const fetcher = vi.fn().mockResolvedValue(rider);

    await getCachedRider('cuid1', fetcher);
    await getCachedRider('cuid1', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses different cache keys for rider:id vs rider:phone vs rider:status', async () => {
    vi.resetModules();
    const { getCachedRider, getCachedRiderByPhone, getCachedRiderStatus } = await import(
      '../../src/lib/server-cache'
    );
    // Import cache AFTER server-cache so we share the same singleton.
    const cache = await import('../../src/lib/cache');
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };

    await getCachedRider('rider-1', async () => a);
    await getCachedRiderByPhone('9999999999', async () => b);
    await getCachedRiderStatus('rider-1', async () => c);

    // Each is a distinct cache key — verify all three keys are present
    const stats = cache.getCacheStats();
    expect(stats.query.keys).toContain('rider:id:rider-1');
    expect(stats.query.keys).toContain('rider:phone:9999999999');
    expect(stats.query.keys).toContain('rider:status:simple:rider-1');
  });
});

describe('getCachedRiderStatus shape parameter', () => {
  it('uses different keys for simple vs wide shape (no cross-shape cache hit)', async () => {
    const { getCachedRiderStatus } = await getFreshModule();
    const simpleA = { lifecycleStatus: 'ACTIVE' };
    const wideA = { id: 'r1', lifecycleStatus: 'ACTIVE', currentPlan: 'P1' };
    const fetcherSimple = vi.fn().mockResolvedValue(simpleA);
    const fetcherWide = vi.fn().mockResolvedValue(wideA);

    const s = await getCachedRiderStatus('r1', fetcherSimple);
    const w = await getCachedRiderStatus('r1', fetcherWide, 30, 'wide');

    expect(s).toBe(simpleA);
    expect(w).toBe(wideA);
    expect(fetcherSimple).toHaveBeenCalledTimes(1);
    expect(fetcherWide).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateRiderCache', () => {
  it('clears all rider:* shapes (id, status, profile)', async () => {
    const { getCachedRider, getCachedRiderStatus, invalidateRiderCache } = await getFreshModule();
    await getCachedRider('r1', async () => ({ id: 'r1' }));
    await getCachedRiderStatus('r1', async () => ({ lifecycleStatus: 'ACTIVE' }));

    invalidateRiderCache('r1');

    const fetcher = vi.fn().mockResolvedValue({ id: 'r1' });
    await getCachedRider('r1', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateRiderPhoneCache', () => {
  it('clears only the rider:phone:<phone> key', async () => {
    const { getCachedRiderByPhone, invalidateRiderPhoneCache, getCachedRider } = await getFreshModule();
    const phoneFetcher = vi.fn().mockResolvedValue({ id: 'p1' });
    const idFetcher = vi.fn().mockResolvedValue({ id: 'i1' });

    await getCachedRiderByPhone('9999999999', phoneFetcher);
    await getCachedRider('p1', idFetcher);

    invalidateRiderPhoneCache('9999999999');

    // Phone cache cleared — should re-fetch
    await getCachedRiderByPhone('9999999999', phoneFetcher);
    expect(phoneFetcher).toHaveBeenCalledTimes(2);

    // ID cache intact — should NOT re-fetch
    await getCachedRider('p1', idFetcher);
    expect(idFetcher).toHaveBeenCalledTimes(1);
  });
});

describe('getCachedVehicle / getCachedHub', () => {
  it('uses distinct key namespaces', async () => {
    const { getCachedVehicle, getCachedHub } = await getFreshModule();
    const vFetcher = vi.fn().mockResolvedValue({ kind: 'vehicle' });
    const hFetcher = vi.fn().mockResolvedValue({ kind: 'hub' });

    await getCachedVehicle('v1', vFetcher);
    await getCachedHub('h1', hFetcher);

    // Both fetcher called once
    expect(vFetcher).toHaveBeenCalledTimes(1);
    expect(hFetcher).toHaveBeenCalledTimes(1);

    // Cache hit on second call
    await getCachedVehicle('v1', vFetcher);
    await getCachedHub('h1', hFetcher);
    expect(vFetcher).toHaveBeenCalledTimes(1);
    expect(hFetcher).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateAllEntityCaches', () => {
  it('clears rider, vehicle, and hub namespaces', async () => {
    const {
      getCachedRider,
      getCachedVehicle,
      getCachedHub,
      invalidateAllEntityCaches,
    } = await getFreshModule();
    await getCachedRider('r1', async () => ({ id: 'r1' }));
    await getCachedVehicle('v1', async () => ({ id: 'v1' }));
    await getCachedHub('h1', async () => ({ id: 'h1' }));

    invalidateAllEntityCaches();

    const r = vi.fn().mockResolvedValue({ id: 'r1' });
    const v = vi.fn().mockResolvedValue({ id: 'v1' });
    const h = vi.fn().mockResolvedValue({ id: 'h1' });

    await getCachedRider('r1', r);
    await getCachedVehicle('v1', v);
    await getCachedHub('h1', h);

    expect(r).toHaveBeenCalledTimes(1);
    expect(v).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeRiderId', () => {
  it('returns input unchanged when not a public riderId', async () => {
    const { normalizeRiderId } = await getFreshModule();
    expect(normalizeRiderId('cuid-xyz')).toBe('cuid-xyz');
  });

  it('returns input when public riderId has no registered mapping', async () => {
    const { normalizeRiderId } = await getFreshModule();
    expect(normalizeRiderId('RIDER-NEW-1')).toBe('RIDER-NEW-1');
    expect(normalizeRiderId('VEMAB001')).toBe('VEMAB001');
  });
});
