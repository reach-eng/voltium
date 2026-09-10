/**
 * Outbox health evaluation (P1-4).
 *
 * Four routes used to compute outbox verdicts independently with
 * drifting threshold sets (health main, health worker, admin
 * workflow-coverage, the now-deleted admin server-health). This
 * helper is the single source of truth for the threshold table;
 * each route feeds in its own counts and reads back a status.
 *
 * Two SQL "stuck" queries are still separate (PROCESSING @ 5m for
 * the workflow-coverage screen, PENDING @ 15m for the worker
 * screen) because they answer different questions: a PROCESSING
 * event stuck for 5m means the worker died holding the row; a
 * PENDING event stuck for 15m means nothing is picking it up. The
 * helper unifies only the threshold numbers, not the queries.
 */

export type OutboxStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface OutboxHealthInput {
  /** PENDING count. */
  pending: number;
  /** FAILED count. */
  failed: number;
  /**
   * "stuck" count from whichever query the caller is using
   * (PROCESSING @ 5m or PENDING @ 15m). The threshold table does
   * not depend on which one.
   */
  stuck: number;
  /** Age of the oldest pending event in seconds (informational). */
  oldestPendingAgeSeconds: number | null;
}

export const OUTBOX_QUEUE_DEPTH_DEGRADED = 100;
export const OUTBOX_FAILED_DEGRADED = 10;
export const OUTBOX_FAILED_UNHEALTHY = 50;
export const OUTBOX_STUCK_DEGRADED = 0;
export const OUTBOX_STUCK_UNHEALTHY = 10;

export function evaluateOutboxHealth(s: OutboxHealthInput): OutboxStatus {
  if (s.stuck > OUTBOX_STUCK_UNHEALTHY || s.failed > OUTBOX_FAILED_UNHEALTHY) {
    return 'unhealthy';
  }
  if (
    s.pending > OUTBOX_QUEUE_DEPTH_DEGRADED ||
    s.failed > OUTBOX_FAILED_DEGRADED ||
    s.stuck > OUTBOX_STUCK_DEGRADED
  ) {
    return 'degraded';
  }
  return 'healthy';
}
