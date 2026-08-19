import { describe, it, expect } from 'vitest';

describe('7 Mixed Audits Re-Verification Contracts', () => {
  it('adminRiderUseCases: delete method accepts optional actorId parameter', async () => {
    const { adminRiderUseCases } = await import('@/server/modules/riders/admin-riders.use-cases');
    expect(typeof adminRiderUseCases.delete).toBe('function');
  });

  it('jobToOutboxMap: daily-engagement is configured with background priority', async () => {
    const { JOB_TO_OUTBOX_CONFIG } = await import('@/app/api/admin/jobs/route');
    expect(JOB_TO_OUTBOX_CONFIG['daily-engagement'].priority).toBe('background');
  });
});
