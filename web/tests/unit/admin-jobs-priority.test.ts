import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  emit: vi.fn(),
  createAuditLog: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('@/lib/permissions', () => ({ hasPermission: mocks.hasPermission }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: mocks.emit },
  OutboxEventTypes: {
    ADMIN_JOB_WALLET_RECONCILIATION: 'admin.job.wallet_reconciliation',
    ADMIN_JOB_RENT_DUE_CHECK: 'admin.job.rent_due_check',
    ADMIN_JOB_DEVICE_COMPLIANCE: 'admin.job.device_compliance',
    ADMIN_JOB_REFERRAL_REWARD: 'admin.job.referral_reward',
    ADMIN_JOB_NOTIFICATIONS_CLEANUP: 'admin.job.notifications_cleanup',
    ADMIN_JOB_TELEMETRY_CLEANUP: 'admin.job.telemetry_cleanup',
    ADMIN_JOB_DAILY_ENGAGEMENT: 'admin.job.daily_engagement',
  },
}));

import { POST } from '@/app/api/admin/jobs/route';

function makeJobRequest(jobId: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/jobs', {
    method: 'POST',
    body: JSON.stringify({ jobId }),
  });
}

describe('Admin Jobs Outbox Priority Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'SUPER_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.emit.mockResolvedValue('outbox_123');
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it('enqueues background jobs with priority: "background"', async () => {
    const res = await POST(makeJobRequest('notifications-cleanup'));
    expect(res.status).toBe(202);
    expect(mocks.emit).toHaveBeenCalledWith(
      'admin.job.notifications_cleanup',
      expect.objectContaining({ jobId: 'notifications-cleanup' }),
      3,
      undefined,
      'background'
    );
  });

  it('enqueues interactive jobs with priority: "interactive"', async () => {
    const res = await POST(makeJobRequest('rent-due-checker'));
    expect(res.status).toBe(202);
    expect(mocks.emit).toHaveBeenCalledWith(
      'admin.job.rent_due_check',
      expect.objectContaining({ jobId: 'rent-due-checker' }),
      3,
      undefined,
      'interactive'
    );
  });
});
