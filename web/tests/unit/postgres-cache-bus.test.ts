import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresCacheBus, CACHE_CHANNEL } from '@/lib/postgres-cache-bus';
import { invalidateCache, cacheResponse, getCachedResponse } from '@/lib/cache';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  },
}));

describe('PostgresCacheBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCache();
  });

  it('publishes invalidation events via db.$executeRawUnsafe with pg_notify', async () => {
    await PostgresCacheBus.publish('rider:id:123');

    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_notify($1, $2)',
      CACHE_CHANNEL,
      expect.stringContaining('"pattern":"rider:id:123"')
    );
  });

  it('handles incoming notifications and invalidates local cache when origin is different', () => {
    cacheResponse('rider:id:123', { name: 'Rider A' });
    expect(getCachedResponse('rider:id:123')).not.toBeNull();

    const remotePayload = JSON.stringify({
      pattern: 'rider:id:123',
      origin: 'remote_pod_999',
      timestamp: Date.now(),
    });

    const handled = PostgresCacheBus.handleNotification(CACHE_CHANNEL, remotePayload);
    expect(handled).toBe(true);
    expect(getCachedResponse('rider:id:123')).toBeNull();
  });

  it('ignores notifications originating from self to avoid redundant clears', () => {
    cacheResponse('rider:id:123', { name: 'Rider A' });

    const selfPayload = JSON.stringify({
      pattern: 'rider:id:123',
      origin: PostgresCacheBus.getInstanceId(),
      timestamp: Date.now(),
    });

    const handled = PostgresCacheBus.handleNotification(CACHE_CHANNEL, selfPayload);
    expect(handled).toBe(false);
    expect(getCachedResponse('rider:id:123')).not.toBeNull();
  });

  it('gracefully ignores invalid channels or malformed payloads', () => {
    const wrongChannel = PostgresCacheBus.handleNotification('other_channel', '{}');
    expect(wrongChannel).toBe(false);

    const malformed = PostgresCacheBus.handleNotification(CACHE_CHANNEL, 'not-json');
    expect(malformed).toBe(false);
  });
});
