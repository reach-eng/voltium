/**
 * PR-VER-2026-08-07 (EVENT_BUS P1-2) — worker-wiring regression guard for
 * the admin-triggered Daily Engagement job.
 *
 * The admin "Run now" button on the Background Jobs screen emits
 * `admin.job.daily_engagement` — which previously had NO worker entry, so
 * the outbox row sat PENDING forever and the admin trigger was a silent
 * no-op (the same bug class as ADMIN_JOB_RENT_DUE_CHECK / reconciliation).
 *
 * This test asserts the source-level contract on BOTH sides of the pipe:
 *   - workers/index.ts must route ADMIN_JOB_DAILY_ENGAGEMENT (and the
 *     scheduled DAILY_ENGAGEMENT) to `dailyEngagementJob.process` with
 *     background priority;
 *   - the jobs route must map the `daily-engagement` card to the same
 *     event type, so the emitter and the consumer can't drift apart.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const WORKERS_INDEX = resolve(
  __dirname,
  '../../../src/server/workers/index.ts'
);
const JOBS_ROUTE = resolve(__dirname, '../../../src/app/api/admin/jobs/route.ts');

function src(path: string): string {
  return readFileSync(path, 'utf-8');
}

describe('Workers wiring — daily engagement (EVENT_BUS P1-2)', () => {
  it('workers/index.ts and the jobs route exist', () => {
    expect(existsSync(WORKERS_INDEX)).toBe(true);
    expect(existsSync(JOBS_ROUTE)).toBe(true);
  });

  it('routes the scheduled DAILY_ENGAGEMENT event to dailyEngagementJob.process', () => {
    const s = src(WORKERS_INDEX);
    const entry = s.match(
      /jobType:\s*OutboxEventTypes\.DAILY_ENGAGEMENT[\s\S]{0,300}processor:\s*dailyEngagementJob\.process/
    );
    expect(
      entry,
      'DAILY_ENGAGEMENT (scheduled 06:00 IST) must keep its consumer'
    ).not.toBeNull();
  });

  it('routes the admin-triggered ADMIN_JOB_DAILY_ENGAGEMENT event to dailyEngagementJob.process', () => {
    const s = src(WORKERS_INDEX);
    const entry = s.match(
      /jobType:\s*OutboxEventTypes\.ADMIN_JOB_DAILY_ENGAGEMENT[\s\S]{0,300}processor:\s*dailyEngagementJob\.process/
    );
    expect(
      entry,
      'ADMIN_JOB_DAILY_ENGAGEMENT (the admin Run-now path) must have a consumer'
    ).not.toBeNull();
  });

  it('marks the admin-triggered entry as background priority', () => {
    const s = src(WORKERS_INDEX);
    const entry = s.match(
      /jobType:\s*OutboxEventTypes\.ADMIN_JOB_DAILY_ENGAGEMENT[\s\S]{0,500}priority:\s*'background'/
    );
    expect(
      entry,
      'admin-triggered engagement must not starve interactive workers'
    ).not.toBeNull();
  });

  it('imports dailyEngagementJob from the daily-engagement job module', () => {
    const s = src(WORKERS_INDEX);
    expect(s).toMatch(
      /import\s*\{[^}]*dailyEngagementJob[^}]*\}\s*from\s*'\.\/jobs\/daily-engagement\.job'/
    );
  });

  it('jobs route maps the daily-engagement card to ADMIN_JOB_DAILY_ENGAGEMENT with background priority', () => {
    const s = src(JOBS_ROUTE);
    const mapping = s.match(
      /'daily-engagement':\s*\{[\s\S]{0,200}eventType:\s*OutboxEventTypes\.ADMIN_JOB_DAILY_ENGAGEMENT[\s\S]{0,200}priority:\s*'background'/
    );
    expect(
      mapping,
      'the Run-now emitter must map to the wired event type (emitter ↔ consumer pairing)'
    ).not.toBeNull();
  });
});
