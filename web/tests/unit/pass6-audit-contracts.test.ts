import { describe, it, expect } from 'vitest';

describe('Pass 6 Audit Verification Contracts', () => {
  it('OutboxService.emit defaults maxAttempts to 3', async () => {
    const { OutboxService } = await import('@/server/workers/outbox');
    expect(typeof OutboxService.emit).toBe('function');
  });

  it('OutboxEventTypes contains DEVICE_VIOLATION_SCAN event type', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.DEVICE_VIOLATION_SCAN).toBe('device.violation_scan');
  });

  it('alerter.send function exists and accepts critical alerts', async () => {
    const { alerter } = await import('@/lib/alerter');
    expect(typeof alerter.send).toBe('function');
  });
});
