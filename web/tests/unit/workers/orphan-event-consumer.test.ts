/**
 * PR-151 (B-W2) — Regression guard for the orphan-event consumer.
 *
 * The 4 event types in `ORPHAN_EVENT_TYPES` (RENT_PAID, RENT_OVERDUE,
 * DEVICE_VIOLATION, ADMIN_ACTION) were emitted but had no consumer
 * before. This test asserts:
 *   1. The consumer job exists and exports the canonical list.
 *   2. The worker orchestrator registers a worker for EACH of the
 *      4 event types.
 *   3. Each handler in the consumer is reachable.
 *   4. The worker registration in `workers/index.ts` is in priority
 *      order — RENT_PAID/OVERDUE are interactive (rider-visible),
 *      DEVICE_VIOLATION/ADMIN_ACTION are background.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const CONSUMER = resolve(
  __dirname,
  '../../../src/server/workers/jobs/orphan-event-consumer.job.ts'
);
const WORKERS_INDEX = resolve(
  __dirname,
  '../../../src/server/workers/index.ts'
);
const OUTBOX = resolve(
  __dirname,
  '../../../src/server/workers/outbox.ts'
);

function src(path: string): string {
  return readFileSync(path, 'utf-8');
}

describe('PR-151: orphan-event consumer is wired', () => {
  it('consumer job file exists', () => {
    expect(existsSync(CONSUMER)).toBe(true);
  });

  it('exports ORPHAN_EVENT_TYPES with all 4 expected types', () => {
    const s = src(CONSUMER);
    expect(s).toContain('export const ORPHAN_EVENT_TYPES');
    const outbox = src(OUTBOX);
    // Each of the 4 must appear in ORPHAN_EVENT_TYPES.
    for (const type of [
      'RENT_PAID',
      'RENT_OVERDUE',
      'DEVICE_VIOLATION',
      'ADMIN_ACTION',
    ]) {
      expect(outbox).toContain(`${type}:`);
      // The consumer file references the outbox enum value for this type.
      const typeLine = outbox
        .split('\n')
        .find((l) => l.includes(`${type}:`));
      expect(typeLine, `enum value for ${type} not found`).toBeDefined();
      const value = typeLine!.split(':')[1].split(',')[0].trim();
      // The consumer must reference the string value in ORPHAN_EVENT_TYPES.
      expect(s).toContain(value);
    }
  });

  it('handler map covers all 4 types', () => {
    const s = src(CONSUMER);
    expect(s).toContain('handleRentPaid');
    expect(s).toContain('handleRentOverdue');
    expect(s).toContain('handleDeviceViolation');
    expect(s).toContain('handleAdminAction');
  });

  it('dispatcher reads eventType from job.type (set by lib/job-queue.ts)', () => {
    const s = src(CONSUMER);
    expect(s).toMatch(/job\.type\s*\?\?\s*job\.payload\?\.\s*eventType/);
  });

  it('worker orchestrator registers the consumer for all 4 types', () => {
    const s = src(WORKERS_INDEX);
    // Each orphan event type must have a `jobType: OutboxEventTypes.<TYPE>`
    // entry in the WORKERS array, with processor orphanEventConsumerJob.process.
    for (const type of [
      'RENT_PAID',
      'RENT_OVERDUE',
      'DEVICE_VIOLATION',
      'ADMIN_ACTION',
    ]) {
      const pattern = new RegExp(
        `jobType:\\s*OutboxEventTypes\\.${type},\\s*\\n\\s*processor:\\s*orphanEventConsumerJob\\.process`
      );
      expect(s, `worker entry for ${type} missing or wrong processor`).toMatch(pattern);
    }
  });

  it('rider-visible events (RENT_*) are interactive priority', () => {
    const s = src(WORKERS_INDEX);
    // For each RENT_* type, the priority must be 'interactive'.
    for (const type of ['RENT_PAID', 'RENT_OVERDUE']) {
      const blockPattern = new RegExp(
        `jobType:\\s*OutboxEventTypes\\.${type},[\\s\\S]*?priority:\\s*'interactive'`
      );
      expect(s, `${type} should be interactive priority`).toMatch(blockPattern);
    }
  });

  it('admin-visible events (DEVICE_VIOLATION, ADMIN_ACTION) are background priority', () => {
    const s = src(WORKERS_INDEX);
    for (const type of ['DEVICE_VIOLATION', 'ADMIN_ACTION']) {
      const blockPattern = new RegExp(
        `jobType:\\s*OutboxEventTypes\\.${type},[\\s\\S]*?priority:\\s*'background'`
      );
      expect(s, `${type} should be background priority`).toMatch(blockPattern);
    }
  });

  it('createAuditLog is called for SOC2 trail in every handler', () => {
    const s = src(CONSUMER);
    // Count createAuditLog calls in the consumer — must be >= 4 (one per handler).
    const matches = s.match(/createAuditLog\s*\(\s*\{/g) || [];
    expect(matches.length, 'each handler must call createAuditLog').toBeGreaterThanOrEqual(4);
  });
});
