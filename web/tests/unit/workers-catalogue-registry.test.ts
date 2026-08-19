import { describe, it, expect } from 'vitest';
import { WORKERS } from '@/server/workers';
import { OutboxEventTypes } from '@/server/workers/outbox';

describe('Workers Catalogue Registry', () => {
  it('includes worker registration for ADMIN_JOB_TELEMETRY_CLEANUP', () => {
    const telemetryWorker = WORKERS.find(
      (w) => w.jobType === OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP
    );
    expect(telemetryWorker).toBeDefined();
    expect(telemetryWorker?.priority).toBe('background');
  });
});
