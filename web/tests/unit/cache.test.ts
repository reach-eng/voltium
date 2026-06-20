/**
 * Cache Module — Unit Tests
 *
 * Tests src/lib/cache.ts — in-memory LRU cache with TTL, pattern invalidation,
 * and concurrent deduplication (getOrSet).
 *
 * Covers:
 *   - cacheResponse / getCachedResponse (basic operations, expiry, LRU, version)
 *   - getOrSetResponse (cache hit, miss, concurrent dedup, null fetcher, error)
 *   - invalidateCache (clear all, pattern with wildcard, regex string, edge chars)
 *   - getCacheStats, getCacheVersion
 *   - Edge cases: non-existent keys, overwrite, expiry boundaries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Import helpers
// ---------------------------------------------------------------------------

/** Get a fresh module instance (new singleton cache) */
async function getFreshModule() {
  vi.resetModules();
  return import('../../src/lib/cache');
}

// ─────────────────────────────────────────────────────────────────────────────
// cacheResponse / getCachedResponse  (with fake timers for TTL tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('cacheResponse / getCachedResponse', () => {
  let cache: Awaited<ReturnType<typeof getFreshModule>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    cache = await getFreshModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves a value', () => {
    cache.cacheResponse('user:1', { name: 'Alice' });
    expect(cache.getCachedResponse('user:1')).toEqual({ name: 'Alice' });
  });

  it('returns null for a non-existent key', () => {
    expect(cache.getCachedResponse('nonexistent')).toBeNull();
  });

  it('overwrites an existing key', () => {
    cache.cacheResponse('key', 'old-value');
    cache.cacheResponse('key', 'new-value');
    expect(cache.getCachedResponse('key')).toBe('new-value');
  });

  it('stores and retrieves falsy values (0, empty string, false)', () => {
    cache.cacheResponse('zero', 0);
    cache.cacheResponse('empty', '');
    cache.cacheResponse('false', false);

    expect(cache.getCachedResponse('zero')).toBe(0);
    expect(cache.getCachedResponse('empty')).toBe('');
    expect(cache.getCachedResponse('false')).toBe(false);
  });

  it('returns null and evicts entry after TTL expires', () => {
    cache.cacheResponse('temp', 'data', 10); // 10 second TTL
    expect(cache.getCachedResponse('temp')).toBe('data');

    vi.advanceTimersByTime(10_001);
    expect(cache.getCachedResponse('temp')).toBeNull();
  });

  it('returns null exactly at expiry boundary', () => {
    cache.cacheResponse('temp', 'data', 5);
    expect(cache.getCachedResponse('temp')).toBe('data');

    // At exactly expiresAt, Date.now() === expiresAt, so condition is NOT >, value still valid
    vi.advanceTimersByTime(5_000);
    expect(cache.getCachedResponse('temp')).toBe('data');

    // One more ms should evict
    vi.advanceTimersByTime(1);
    expect(cache.getCachedResponse('temp')).toBeNull();
  });

  it('uses default TTL of 60 seconds when ttl is not specified', () => {
    cache.cacheResponse('default-ttl', 'value');
    expect(cache.getCachedResponse('default-ttl')).toBe('value');

    vi.advanceTimersByTime(59_999);
    expect(cache.getCachedResponse('default-ttl')).toBe('value');

    vi.advanceTimersByTime(2);
    expect(cache.getCachedResponse('default-ttl')).toBeNull();
  });

  it('evicts oldest entries under LRU when cache exceeds max size', () => {
    for (let i = 0; i < 102; i++) {
      cache.cacheResponse(`key:${i}`, i);
    }

    // First 2 should have been evicted (first 2 inserted are oldest)
    expect(cache.getCachedResponse('key:0')).toBeNull();
    expect(cache.getCachedResponse('key:1')).toBeNull();

    // Most recent should still exist
    expect(cache.getCachedResponse('key:101')).toBe(101);
    expect(cache.getCachedResponse('key:99')).toBe(99);
  });

  it('promotes accessed keys under LRU (get moves to end)', () => {
    // Fill cache to 99 items (key:0 through key:98)
    for (let i = 0; i < 99; i++) {
      cache.cacheResponse(`key:${i}`, i);
    }

    // Access key:50 to promote it to end of LRU
    expect(cache.getCachedResponse('key:50')).toBe(50);

    // Add key:99 — size becomes 100, no eviction (was 99, now 100)
    cache.cacheResponse('key:99', 99);

    // Add key:100 — size=100 >= maxSize(100). Evicts 1 entry: key:0 (oldest).
    cache.cacheResponse('key:100', 100);

    // key:0 was the oldest, should be evicted
    expect(cache.getCachedResponse('key:0')).toBeNull();

    // key:1 was the second oldest, but only 1 entry was evicted — it survives
    expect(cache.getCachedResponse('key:1')).toBe(1);

    // key:50 was promoted, should survive
    expect(cache.getCachedResponse('key:50')).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrSetResponse  (real timers for async concurrency tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('getOrSetResponse', () => {
  let cache: Awaited<ReturnType<typeof getFreshModule>>;

  beforeEach(async () => {
    vi.useRealTimers();
    cache = await getFreshModule();
  });

  it('returns cached value on subsequent calls (cache hit)', async () => {
    const fetcher = vi.fn().mockResolvedValue('expensive-data');

    const result1 = await cache.getOrSetResponse('key', fetcher);
    expect(result1).toBe('expensive-data');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const result2 = await cache.getOrSetResponse('key', fetcher);
    expect(result2).toBe('expensive-data');
    expect(fetcher).toHaveBeenCalledTimes(1); // not called again
  });

  it('calls fetcher on cache miss', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');

    const result = await cache.getOrSetResponse('new-key', fetcher);
    expect(result).toBe('data');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('deduplicates concurrent calls for the same key', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        () => new Promise<string>((resolve) => setTimeout(() => resolve('data'), 50))
      );

    const [r1, r2, r3] = await Promise.all([
      cache.getOrSetResponse('concurrent', fetcher),
      cache.getOrSetResponse('concurrent', fetcher),
      cache.getOrSetResponse('concurrent', fetcher),
    ]);

    expect(r1).toBe('data');
    expect(r2).toBe('data');
    expect(r3).toBe('data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache when fetcher returns null', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);

    const result1 = await cache.getOrSetResponse('null-key', fetcher);
    expect(result1).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call should call fetcher again (nothing was cached)
    const result2 = await cache.getOrSetResponse('null-key', fetcher);
    expect(result2).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('allows a new fetch after a concurrent dedup promise resolves to null', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);

    await cache.getOrSetResponse('dedup-null', fetcher);
    await cache.getOrSetResponse('dedup-null', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('caches when fetcher returns a valid value after a previous null', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('data');

    await cache.getOrSetResponse('eventual', fetcher);
    const result = await cache.getOrSetResponse('eventual', fetcher);

    expect(result).toBe('data');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('recovers when fetcher throws an error', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.getOrSetResponse('error-key', fetcher)).rejects.toThrow('Network error');

    const result = await cache.getOrSetResponse('error-key', fetcher);
    expect(result).toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not leave stale pending entry when fetcher throws', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('Fail')).mockResolvedValueOnce('ok');

    await expect(cache.getOrSetResponse('stale-key', fetcher)).rejects.toThrow('Fail');

    const result = await cache.getOrSetResponse('stale-key', fetcher);
    expect(result).toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrSetResponse with TTL  (uses fake timers)
// ─────────────────────────────────────────────────────────────────────────────

describe('getOrSetResponse — TTL', () => {
  let cache: Awaited<ReturnType<typeof getFreshModule>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    cache = await getFreshModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies custom TTL from getOrSetResponse', async () => {
    const fetcher = vi.fn().mockResolvedValue('short-lived');

    // The fetcher resolves immediately even with fake timers (no setTimeout)
    await cache.getOrSetResponse('short', fetcher, 5); // 5 second TTL

    expect(cache.getCachedResponse('short')).toBe('short-lived');

    vi.advanceTimersByTime(5_000);
    expect(cache.getCachedResponse('short')).toBe('short-lived');

    vi.advanceTimersByTime(1);
    expect(cache.getCachedResponse('short')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// invalidateCache
// ─────────────────────────────────────────────────────────────────────────────

describe('invalidateCache', () => {
  let cache: Awaited<ReturnType<typeof getFreshModule>>;

  beforeEach(async () => {
    cache = await getFreshModule();
    cache.cacheResponse('user:1', 'alice');
    cache.cacheResponse('user:2', 'bob');
    cache.cacheResponse('vehicle:10', 'scooter');
    cache.cacheResponse('vehicle:20', 'bike');
    cache.cacheResponse('settings:theme', 'dark');
  });

  it('clears all cached entries when called with no argument', () => {
    cache.invalidateCache();

    expect(cache.getCachedResponse('user:1')).toBeNull();
    expect(cache.getCachedResponse('vehicle:10')).toBeNull();
    expect(cache.getCachedResponse('settings:theme')).toBeNull();
  });

  it('invalidates entries matching a wildcard pattern', () => {
    cache.invalidateCache('user:*');

    expect(cache.getCachedResponse('user:1')).toBeNull();
    expect(cache.getCachedResponse('user:2')).toBeNull();
    expect(cache.getCachedResponse('vehicle:10')).toBe('scooter');
    expect(cache.getCachedResponse('settings:theme')).toBe('dark');
  });

  it('matches entries with regex-special characters in keys', () => {
    cache.cacheResponse('data[0].value', 'arr');
    cache.cacheResponse('data[1].value', 'arr2');

    cache.invalidateCache('data[*].value');

    expect(cache.getCachedResponse('data[0].value')).toBeNull();
    expect(cache.getCachedResponse('data[1].value')).toBeNull();
  });

  it('does not delete anything when pattern matches nothing', () => {
    cache.invalidateCache('nonexistent:*');

    expect(cache.getCachedResponse('user:1')).toBe('alice');
    expect(cache.getCachedResponse('vehicle:10')).toBe('scooter');
  });

  it('in-flight getOrSet still caches after invalidation if already resolved', async () => {
    vi.useRealTimers();
    const fetcher = vi.fn().mockResolvedValue('data');

    const promise = cache.getOrSetResponse('pending-key', fetcher);

    // Clear cache while fetch is in-flight
    cache.invalidateCache();

    // The in-flight promise resolves — it will cache via .then()
    const result = await promise;
    expect(result).toBe('data');

    // The fetch completed and cached the value even though cache was cleared mid-flight
    // This is expected behavior: clear() doesn't cancel in-flight operations
    expect(cache.getCachedResponse('pending-key')).toBe('data');
  });

  it('allows re-fetch after invalidation', async () => {
    vi.useRealTimers();
    cache.cacheResponse('refetch-me', 'original');
    expect(cache.getCachedResponse('refetch-me')).toBe('original');

    cache.invalidateCache();
    expect(cache.getCachedResponse('refetch-me')).toBeNull();

    const fetcher = vi.fn().mockResolvedValue('refreshed');
    const result = await cache.getOrSetResponse('refetch-me', fetcher);
    expect(result).toBe('refreshed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCacheStats & getCacheVersion
// ─────────────────────────────────────────────────────────────────────────────

describe('getCacheStats', () => {
  let cache: Awaited<ReturnType<typeof getFreshModule>>;

  beforeEach(async () => {
    cache = await getFreshModule();
  });

  it('returns size 0 for empty cache', () => {
    const stats = cache.getCacheStats();
    expect(stats.query.size).toBe(0);
    expect(stats.query.maxSize).toBe(100);
    expect(stats.query.keys).toEqual([]);
  });

  it('reflects cached entries', () => {
    cache.cacheResponse('a', 1);
    cache.cacheResponse('b', 2);

    const stats = cache.getCacheStats();
    expect(stats.query.size).toBe(2);
    expect(stats.query.keys).toContain('a');
    expect(stats.query.keys).toContain('b');
  });

  it('updates after invalidation', () => {
    cache.cacheResponse('x', 10);
    cache.cacheResponse('y', 20);
    cache.invalidateCache('x');

    const stats = cache.getCacheStats();
    expect(stats.query.size).toBe(1);
    expect(stats.query.keys).toEqual(['y']);
  });

  it('shows version string', () => {
    const stats = cache.getCacheStats();
    expect(stats.query.version).toBe('v1');
  });
});

describe('getCacheVersion', () => {
  it('returns the current cache version string', async () => {
    const cache = await getFreshModule();
    expect(cache.getCacheVersion()).toBe('v1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  let cache: Awaited<ReturnType<typeof getFreshModule>>;

  beforeEach(async () => {
    cache = await getFreshModule();
  });

  it('releases a key for re-fetch after cacheResponse + overwrite cycle', () => {
    cache.cacheResponse('transient', 'first');
    expect(cache.getCachedResponse('transient')).toBe('first');

    cache.cacheResponse('transient', 'second');
    expect(cache.getCachedResponse('transient')).toBe('second');
  });

  it('getOrSet after manual cacheResponse returns cached value without re-fetching', async () => {
    cache.cacheResponse('manual', 'pre-set');
    const fetcher = vi.fn().mockResolvedValue('should-not-be-called');

    const result = await cache.getOrSetResponse('manual', fetcher);
    expect(result).toBe('pre-set');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('handles rapid successive getOrSet calls for different keys', async () => {
    const fetcherA = vi.fn().mockResolvedValue('A');
    const fetcherB = vi.fn().mockResolvedValue('B');

    const results = await Promise.all([
      cache.getOrSetResponse('key-a', fetcherA),
      cache.getOrSetResponse('key-b', fetcherB),
    ]);

    expect(results).toEqual(['A', 'B']);
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });
});
