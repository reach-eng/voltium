/**
 * PR-89 (API N3) — admin/jobs POST is now async + 202.
 *
 * Verifies the three contract changes for the API N3 partial:
 *   1. POST returns 202 with a generic "Queued" body, not a result
 *      payload.
 *   2. POST writes a single outbox event whose type matches the
 *      jobId mapping in `outbox.ts`.
 *   3. Errors do NOT leak `err.message` into the response body — the
 *      500 response is the generic "Job failed".
 *
 * The pre-PR-89 behavior was a synchronous `await someJob.process(...)`
 * that blocked the event loop. After this PR the route only emits an
 * outbox event and returns 202.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const SESSION = {
  riderDbId: 'admin-1',
  adminId: 'admin-1',
  role: 'admin',
  adminRole: 'SUPER_ADMIN',
};

vi.mock('@/lib/rbac', () => ({
  requireAdmin: vi.fn().mockResolvedValue(SESSION),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

const emitMock = vi.fn();
const outboxEventTypesMock = {
  ADMIN_JOB_WALLET_RECONCILIATION: 'admin.job.wallet_reconciliation',
  ADMIN_JOB_RENT_DUE_CHECK: 'admin.job.rent_due_check',
  ADMIN_JOB_DEVICE_COMPLIANCE: 'admin.job.device_compliance',
  ADMIN_JOB_REFERRAL_REWARD: 'admin.job.referral_reward',
  ADMIN_JOB_NOTIFICATIONS_CLEANUP: 'admin.job.notifications_cleanup',
  ADMIN_JOB_TELEMETRY_CLEANUP: 'admin.job.telemetry_cleanup',
  ADMIN_JOB_DAILY_ENGAGEMENT: 'admin.job.daily_engagement',
};

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: emitMock },
  OutboxEventTypes: outboxEventTypesMock,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const reconHistory = [
  {
    id: 'r-1',
    reportDate: '2026-08-04',
    totalWallets: 100,
    matched: 99,
    mismatched: 1,
    drift: 200,
    createdAt: new Date('2026-08-04T02:00:00Z'),
  },
];

vi.mock('@/lib/db', () => ({
  db: {
    reconciliationReport: {
      findMany: vi.fn().mockResolvedValue(reconHistory),
    },
    systemSetting: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { POST, GET } = await import('@/app/api/admin/jobs/route');

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/jobs', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function callPost(body: unknown) {
  return POST(makeReq(body));
}

describe('POST /api/admin/jobs — PR-89 (API N3) async enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitMock.mockResolvedValue('outbox-evt-1');
  });

  it('returns 202 with a generic "Queued" body, not a result payload', async () => {
    const res = await callPost({ jobId: 'wallet-reconciliation' });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.details).toBe('Queued');
    // The route MUST NOT have computed a result object synchronously.
    expect(body.data.result).toBeUndefined();
    expect(body.data.walletBalance).toBeUndefined();
  });

  it('emits a single outbox event whose type maps from jobId', async () => {
    await callPost({ jobId: 'wallet-reconciliation' });
    expect(emitMock).toHaveBeenCalledTimes(1);
    const [eventType, payload, maxAttempts, _tx, priority] = emitMock.mock.calls[0];
    expect(eventType).toBe('admin.job.wallet_reconciliation');
    expect(payload).toMatchObject({
      jobId: 'wallet-reconciliation',
      triggeredBy: SESSION.adminId,
    });
    expect(payload.triggeredAt).toBeTruthy();
    expect(maxAttempts).toBe(3);
    // Interactive priority so the worker doesn't starve the
    // admin-triggered event behind long background jobs.
    expect(priority).toBe('interactive');
  });

  it('rejects an unknown jobId with 400 before emitting', async () => {
    const res = await callPost({ jobId: 'not-a-real-job' });
    expect(res.status).toBe(400);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('rejects a missing jobId with 400 before emitting', async () => {
    const res = await callPost({});
    expect(res.status).toBe(400);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('emits the right event type for each supported jobId', async () => {
    const cases: Array<[string, string]> = [
      ['wallet-reconciliation', 'admin.job.wallet_reconciliation'],
      ['rent-due-checker', 'admin.job.rent_due_check'],
      ['auto-debit', 'admin.job.rent_due_check'],
      ['device-compliance', 'admin.job.device_compliance'],
      ['referral-reward', 'admin.job.referral_reward'],
      ['notifications-cleanup', 'admin.job.notifications_cleanup'],
      ['telemetry-cleanup', 'admin.job.telemetry_cleanup'],
      ['daily-engagement', 'admin.job.daily_engagement'],
    ];
    for (const [jobId, expectedType] of cases) {
      vi.clearAllMocks();
      emitMock.mockResolvedValue(`outbox-${jobId}`);
      const res = await callPost({ jobId });
      expect(res.status).toBe(202);
      expect(emitMock).toHaveBeenCalledTimes(1);
      const [eventType] = emitMock.mock.calls[0];
      expect(eventType).toBe(expectedType);
    }
  });

  it('returns generic 500 body when emit throws — even though err.message is sensitive', async () => {
    emitMock.mockRejectedValue(new Error('db connection string leaked in stack: postgres://user:pass@host'));
    const res = await callPost({ jobId: 'wallet-reconciliation' });
    expect(res.status).toBe(500);
    const text = await res.text();
    // The body must NOT echo the err.message text.
    expect(text).not.toMatch(/postgres:\/\//);
    expect(text).not.toMatch(/connection string/);
    expect(text).not.toMatch(/leaked/);
    // The body MUST be the generic 'Job failed' string from errors.internal.
    expect(text).toMatch(/Job failed/);
  });

  it('GET still returns the jobs list (no behavioral change on the read side)', async () => {
    const req = new NextRequest('http://localhost/api/admin/jobs', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.jobs).toBeInstanceOf(Array);
    expect(body.data.jobs.length).toBeGreaterThan(0);
  });
});
