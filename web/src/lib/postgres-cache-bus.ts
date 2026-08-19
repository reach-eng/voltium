/**
 * PostgreSQL-Native Inter-Process Cache Invalidation Bus.
 *
 * Replaces Redis Pub/Sub for multi-instance / clustered Node.js deployments.
 * Uses PostgreSQL's built-in `pg_notify` / `LISTEN` commands with sub-millisecond
 * latency and zero external infrastructure.
 */

import { db } from './db';
import { invalidateCache } from './cache';
import { logger } from './logger';

export interface CacheInvalidationEvent {
  pattern: string;
  origin: string | number;
  timestamp: number;
}

export const CACHE_CHANNEL = 'voltium_cache_invalidation';

export class PostgresCacheBus {
  private static instanceId = `${process.pid}_${Math.random().toString(36).substring(2, 9)}`;

  /**
   * Broadcast a cache invalidation pattern to all other Node instances in the cluster.
   * Fails silently / gracefully if DB is offline so local operations never block.
   */
  static async publish(pattern: string): Promise<void> {
    try {
      const payload: CacheInvalidationEvent = {
        pattern,
        origin: this.instanceId,
        timestamp: Date.now(),
      };

      // Execute pg_notify via raw query
      await db.$executeRawUnsafe(
        `SELECT pg_notify($1, $2)`,
        CACHE_CHANNEL,
        JSON.stringify(payload)
      );
    } catch (err) {
      // In standalone tests or disconnected mode, non-blocking fallback
      logger.debug('[CacheBus] Non-critical publish failure', { pattern, error: String(err) });
    }
  }

  /**
   * Handle incoming PostgreSQL notifications from other processes.
   */
  static handleNotification(channel: string, rawPayload?: string | null): boolean {
    if (channel !== CACHE_CHANNEL || !rawPayload) return false;

    try {
      const event = JSON.parse(rawPayload) as CacheInvalidationEvent;
      // Ignore messages originating from self
      if (event.origin === this.instanceId) {
        return false;
      }

      if (event.pattern) {
        invalidateCache(event.pattern);
        logger.info('[CacheBus] Applied cross-process invalidation', {
          pattern: event.pattern,
          fromOrigin: event.origin,
        });
        return true;
      }
    } catch (e) {
      logger.warn('[CacheBus] Failed to parse cache notification', { rawPayload, error: String(e) });
    }

    return false;
  }

  static getInstanceId(): string {
    return this.instanceId;
  }
}
