import { describe, it, expect } from 'vitest';
import { api } from '../helpers';

const CRON_SECRET = process.env.CRON_SECRET || '4cdea81cf0032075d868f8d1bc4532dec34bba7b5b8eec6c1b6d6a9151cb545c';
const WORKER_SECRET = process.env.WORKER_SECRET || 'c935868c4ab2c64773921843b41abb420b6ba0f77f17785792aa897464c9fdc5';

describe('3a. Worker Endpoint (POST /api/internal/worker)', () => {
  it('rejects requests without auth header', async () => {
    const res = await api('/api/internal/worker', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects requests with invalid worker secret', async () => {
    const res = await api('/api/internal/worker', {
      method: 'POST',
      token: 'invalid-secret',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('processes jobs with valid worker secret', async () => {
    const res = await api('/api/internal/worker', {
      method: 'POST',
      token: WORKER_SECRET,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processedAt).toBeDefined();
    expect(typeof res.body.processedAt).toBe('string');
  });
});

describe('3b. Cron Notifications (GET /api/cron/notifications)', () => {
  it('rejects requests without auth header', async () => {
    const res = await api('/api/cron/notifications', { method: 'GET' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects requests with invalid cron secret', async () => {
    const res = await api('/api/cron/notifications', {
      method: 'GET',
      token: 'wrong-secret',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('processes scheduled notifications with valid cron secret', async () => {
    const res = await api('/api/cron/notifications', {
      method: 'GET',
      token: CRON_SECRET,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.birthdays).toBe('number');
    expect(typeof res.body.data.paymentReminders).toBe('number');
    expect(typeof res.body.data.referralLeaderboard).toBe('number');
  });
});

describe('3c. Cron Reconciliation (GET /api/cron/reconciliation)', () => {
  it('rejects requests without auth header', async () => {
    const res = await api('/api/cron/reconciliation', { method: 'GET' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects requests with invalid cron secret', async () => {
    const res = await api('/api/cron/reconciliation', {
      method: 'GET',
      token: 'wrong-secret',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('runs wallet reconciliation with valid cron secret', async () => {
    const res = await api('/api/cron/reconciliation', {
      method: 'GET',
      token: CRON_SECRET,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toBeDefined();
    expect(typeof d.totalWallets).toBe('number');
    expect(typeof d.matched).toBe('number');
    expect(typeof d.mismatched).toBe('number');
    expect(typeof d.healthy).toBe('boolean');
    expect(d.reportDate).toBeDefined();
  });
});

describe('3d. Cron Cleanup Telemetry (GET /api/cron/cleanup-telemetry)', () => {
  it('rejects requests without auth header', async () => {
    const res = await api('/api/cron/cleanup-telemetry', { method: 'GET' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('rejects requests with invalid cron secret', async () => {
    const res = await api('/api/cron/cleanup-telemetry', {
      method: 'GET',
      token: 'wrong-secret',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('cleans up stale telemetry with valid cron secret', async () => {
    const res = await api('/api/cron/cleanup-telemetry', {
      method: 'GET',
      token: CRON_SECRET,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toBeDefined();
    expect(typeof d.locations).toBe('number');
    expect(typeof d.callLogs).toBe('number');
    expect(typeof d.contacts).toBe('number');
  });
});
