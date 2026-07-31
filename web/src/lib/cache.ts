import { logger } from './logger';

const CACHE_VERSION = 'v1';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  version: string;
  createdAt: number;
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize = 100;
  private ttl = 60 * 1000;
  private pending = new Map<string, Promise<T | null>>();

  set(key: string, data: T, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.ttl),
      version: CACHE_VERSION,
      createdAt: Date.now(),
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    if (entry.version !== CACHE_VERSION) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
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
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      version: CACHE_VERSION,
      keys: Array.from(this.cache.keys()),
    };
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

export function getCacheVersion(): string {
  return CACHE_VERSION;
}
