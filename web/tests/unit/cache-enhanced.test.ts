import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MemoryCache,
  cacheResponse,
  getCachedResponse,
  getOrSetResponse,
  getOrSetResponseSWR,
  invalidateCache,
  getCacheStats,
  resetCacheStats,
  cachedPrismaQuery,
} from '@/lib/cache';

describe('Enhanced MemoryCache & Caching Utilities', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>({ maxSize: 10, ttlMs: 1000, enableAutoSweep: false });
    resetCacheStats();
    invalidateCache();
  });

  afterEach(() => {
    cache.dispose();
  });

  it('indexes keys by namespace for fast O(1)/O(K) invalidation', () => {
    cache.set('rider:id:101', 'Alice');
    cache.set('rider:id:102', 'Bob');
    cache.set('vehicle:id:501', 'Scooter-1');
    cache.set('admin:deposits:list', 'Deposits');

    expect(cache.get('rider:id:101')).toBe('Alice');
    expect(cache.get('rider:id:102')).toBe('Bob');
    expect(cache.get('vehicle:id:501')).toBe('Scooter-1');

    // Invalidate rider namespace
    const deleted = cache.invalidatePattern('rider:*');
    expect(deleted).toBe(2);
    expect(cache.get('rider:id:101')).toBeNull();
    expect(cache.get('rider:id:102')).toBeNull();
    // Non-rider keys must remain untouched
    expect(cache.get('vehicle:id:501')).toBe('Scooter-1');
    expect(cache.get('admin:deposits:list')).toBe('Deposits');
  });

  it('evicts oldest entries when maxSize is reached (LRU)', () => {
    const smallCache = new MemoryCache<number>({ maxSize: 3, enableAutoSweep: false });
    smallCache.set('k1', 1);
    smallCache.set('k2', 2);
    smallCache.set('k3', 3);

    // Access k1 so k2 becomes the oldest
    expect(smallCache.get('k1')).toBe(1);

    // Insert 4th item
    smallCache.set('k4', 4);

    expect(smallCache.get('k2')).toBeNull(); // Evicted
    expect(smallCache.get('k1')).toBe(1);
    expect(smallCache.get('k3')).toBe(3);
    expect(smallCache.get('k4')).toBe(4);

    const stats = smallCache.getStats();
    expect(stats.evictions).toBe(1);
    smallCache.dispose();
  });

  it('actively purges expired items with purgeExpired()', async () => {
    vi.useFakeTimers();
    cache.set('temp:1', 'val1', 500);
    cache.set('temp:2', 'val2', 2000);

    vi.advanceTimersByTime(600);

    const purged = cache.purgeExpired();
    expect(purged).toBe(1);
    expect(cache.get('temp:1')).toBeNull();
    expect(cache.get('temp:2')).toBe('val2');

    vi.useRealTimers();
  });

  it('supports single-flight promise deduplication (thundering herd protection)', async () => {
    let callCount = 0;
    const slowFetcher = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return 'shared-result';
    };

    const results = await Promise.all([
      cache.getOrSet('concurrent-key', slowFetcher),
      cache.getOrSet('concurrent-key', slowFetcher),
      cache.getOrSet('concurrent-key', slowFetcher),
    ]);

    expect(results).toEqual(['shared-result', 'shared-result', 'shared-result']);
    expect(callCount).toBe(1);
  });

  it('handles Stale-While-Revalidate (SWR) with background refresh', async () => {
    let version = 1;
    const fetcher = async () => `version-${version++}`;

    // Initial fetch: ttl = 500ms, stale = 100ms
    const first = await cache.getOrSetSWR('swr-key', fetcher, 500, 100);
    expect(first).toBe('version-1');

    // Wait past stale window (100ms) but before hard expiry (500ms)
    await new Promise((r) => setTimeout(r, 120));

    // Immediate return of stale value while triggering background revalidation
    const second = await cache.getOrSetSWR('swr-key', fetcher, 500, 100);
    expect(second).toBe('version-1');

    // Give background microtask a brief moment to complete and set the new value
    await new Promise((r) => setTimeout(r, 50));

    // Next read returns updated background value
    const third = cache.get('swr-key');
    expect(third).toBe('version-2');
  });

  it('provides comprehensive stats tracking (hits, misses, hit rate)', () => {
    cache.set('k1', 'v1');
    cache.get('k1'); // hit
    cache.get('k1'); // hit
    cache.get('nonexistent'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });

  it('exports global helper functions correctly', async () => {
    cacheResponse('global:test', { ok: true }, 60);
    expect(getCachedResponse('global:test')).toEqual({ ok: true });

    let dbHits = 0;
    const result1 = await cachedPrismaQuery('prisma:test', async () => {
      dbHits++;
      return { id: 123 };
    });
    const result2 = await cachedPrismaQuery('prisma:test', async () => {
      dbHits++;
      return { id: 123 };
    });

    expect(result1).toEqual({ id: 123 });
    expect(result2).toEqual({ id: 123 });
    expect(dbHits).toBe(1);

    invalidateCache('prisma:*');
    expect(getCachedResponse('prisma:test')).toBeNull();
  });
});
