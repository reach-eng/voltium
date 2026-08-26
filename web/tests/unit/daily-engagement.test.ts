import { describe, it, expect } from 'vitest';
import {
  DAILY_ENGAGEMENT_IST_HOUR,
  msUntilNext0600IST,
} from '@/server/workers/jobs/daily-engagement.job';

describe('msUntilNext0600IST', () => {
  it('exposes the configured IST hour', () => {
    expect(DAILY_ENGAGEMENT_IST_HOUR).toBe(6);
  });

  it('returns a small positive number when called at 05:59 IST', () => {
    // 2026-06-27 05:59:00 IST == 2026-06-27 00:29:00 UTC
    const fakeNow = new Date('2026-06-27T00:29:00.000Z');
    const ms = msUntilNext0600IST(fakeNow);
    // Should be 60 seconds (1 minute) until 06:00 IST.
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(60_000);
  });

  it('returns ~24h when called at 07:00 IST (past today\'s 06:00)', () => {
    // 2026-06-27 07:00:00 IST == 2026-06-27 01:30:00 UTC
    const fakeNow = new Date('2026-06-27T01:30:00.000Z');
    const ms = msUntilNext0600IST(fakeNow);
    // Should be ~23 hours (86_400_000 - 60 * 60_000 = 82_800_000 ms)
    expect(ms).toBeGreaterThan(82_000_000);
    expect(ms).toBeLessThan(86_500_000);
  });

  it('returns 0 or slightly past when called exactly at 06:00 IST', () => {
    // 2026-06-27 06:00:00 IST == 2026-06-27 00:30:00 UTC
    const fakeNow = new Date('2026-06-27T00:30:00.000Z');
    const ms = msUntilNext0600IST(fakeNow);
    // 0 to 60_000 (inclusive of the 1-minute window the scheduler uses)
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(60_000);
  });
});
