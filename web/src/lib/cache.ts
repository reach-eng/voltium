import { logger } from './logger';

const CACHE_VERSION = 'v1';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  /** Optional: serve as stale until this time, then background-revalidate */
  staleAt?: number;
  version: string;
  createdAt: number;
}

/**
 * In-Memory LRU Cache with Promise Deduplication.
 *
 * @warn Single-process scope only. In multi-pod PM2 or clustered environments,
 * cache invalidations do NOT propagate across processes. Only use for idempotent,
 * short-lived, or read-mostly static data (e.g. system configs, app settings).
 * Do NOT use for mutable user state or balance accounting.
 */
class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize = 500;
  private ttl = 60 * 1000;
  private pending = new Map<string, Promise<T | null>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  set(key: string, data: T, ttlMs?: number, staleMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.evictions++;
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      expiresAt: now + (ttlMs || this.ttl),
      staleAt: staleMs !== undefined ? now + staleMs : undefined,
      version: CACHE_VERSION,
      createdAt: now,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    if (entry.version !== CACHE_VERSION) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.data;
  }

  /**
   * Returns `true` if the entry exists but has passed its staleAt threshold.
   * Used by SWR to decide whether a background revalidation is needed.
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry || !entry.staleAt) return false;
    return Date.now() > entry.staleAt;
  }

  /**
   * Get or compute — deduplicates concurrent calls for the same key.
   */
  async getOrSet(key: string, fetcher: () => Promise<T | null>, ttlMs?: number): Promise<T | null> {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const pending = this.pending.get(key);
    if (pending) return pending;

    const promise = fetcher()
      .then((data) => {
        if (data !== null) this.set(key, data, ttlMs);
        return data;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Stale-While-Revalidate: returns cached data immediately (even if stale)
   * and triggers a background refresh when the entry has passed its staleAt.
   * Only one in-flight revalidation runs per key at a time.
   */
  async getOrSetSWR(
    key: string,
    fetcher: () => Promise<T | null>,
    ttlMs?: number,
    staleMs?: number
  ): Promise<T | null> {
    const cached = this.get(key);
    if (cached !== null) {
      // Trigger background revalidation if entry is past its stale window
      if (this.isStale(key) && !this.pending.has(key)) {
        const revalidate = fetcher()
          .then((data) => {
            if (data !== null) this.set(key, data, ttlMs, staleMs);
            return data;
          })
          .finally(() => {
            this.pending.delete(key);
          });
        this.pending.set(key, revalidate);
      }
      return cached;
    }

    // No cache hit — fall through to a blocking fetch
    return this.getOrSet(key, fetcher, ttlMs);
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.pending.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  invalidatePattern(pattern: string | RegExp): number {
    let deleted = 0;
    let regex: RegExp;

    if (pattern instanceof RegExp) {
      regex = pattern;
    } else {
      // Escape regex-special characters before replacing wildcards
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      regex = new RegExp(escaped);
    }

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    logger.info('[Cache] Invalidated', { pattern: pattern.toString(), deleted });
    return deleted;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      version: CACHE_VERSION,
      keys: Array.from(this.cache.keys()),
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  getVersion(): string {
    return CACHE_VERSION;
  }
}

const queryCache = new MemoryCache<unknown>();

export function cacheResponse<T>(key: string, data: T, ttlSeconds = 60): void {
  queryCache.set(key, data, ttlSeconds * 1000);
}

export function getCachedResponse<T>(key: string): T | null {
  return queryCache.get(key) as T | null;
}

export async function getOrSetResponse<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  ttlSeconds = 60
): Promise<T | null> {
  return queryCache.getOrSet(key, fetcher, ttlSeconds * 1000) as Promise<T | null>;
}

/**
 * Stale-While-Revalidate variant of getOrSetResponse.
 *
 * Returns cached data immediately (even if stale up to `ttlSeconds`) while
 * triggering a silent background refresh once the entry has passed `staleSeconds`.
 *
 * Use this for read-heavy admin lists (riders, transactions) where showing
 * data from 30 seconds ago is acceptable in exchange for zero-latency navigation.
 *
 * @param ttlSeconds   Hard expiry — entry is dropped after this.        (default 120s)
 * @param staleSeconds Soft window — background refresh kicks in after.  (default 30s)
 */
export async function getOrSetResponseSWR<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  ttlSeconds = 120,
  staleSeconds = 30
): Promise<T | null> {
  return queryCache.getOrSetSWR(
    key,
    fetcher,
    ttlSeconds * 1000,
    staleSeconds * 1000
  ) as Promise<T | null>;
}

export function invalidateCache(keyPattern?: string): void {
  if (!keyPattern) {
    queryCache.clear();
    return;
  }

  const deleted = queryCache.invalidatePattern(keyPattern);
  logger.info('[Cache] Pattern invalidation complete', { pattern: keyPattern, deleted });
}

export function getCacheStats() {
  return {
    query: queryCache.getStats(),
  };
}

export function resetCacheStats(): void {
  queryCache.resetStats();
}

export async function cachedPrismaQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttlSeconds = 30
): Promise<T> {
  const cached = queryCache.get(cacheKey) as T | null;
  if (cached !== null) return cached;
  const result = await queryFn();
  if (result !== null && result !== undefined) {
    queryCache.set(cacheKey, result, ttlSeconds * 1000);
  }
  return result;
}

export function getCacheVersion(): string {
  return CACHE_VERSION;
}
