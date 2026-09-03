import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runWithRequestContext,
  getRequestContext,
  getCurrentRequestId,
  getCurrentCorrelationId,
  generateCorrelationId,
} from '@/lib/correlation-id';

const mockDb = vi.hoisted(() => ({
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));

const { createAuditLog } = await import('@/lib/audit-log');

describe('Request ID & Context Propagation across Use-Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates unique valid correlation and request IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toEqual(id2);
  });

  it('propagates request context across async use-case execution tree', async () => {
    const customReqId = 'req-test-12345';
    const customCorrId = 'corr-test-67890';

    async function deepServiceCall() {
      // Deep nested service / repository call with NO explicit arguments
      const ctx = getRequestContext();
      const reqId = getCurrentRequestId();
      const corrId = getCurrentCorrelationId();

      return { ctx, reqId, corrId };
    }

    async function sampleUseCase() {
      // Simulate intermediate business logic use-case
      await new Promise((resolve) => setTimeout(resolve, 5));
      return deepServiceCall();
    }

    const result = await runWithRequestContext(
      {
        requestId: customReqId,
        correlationId: customCorrId,
        userId: 'user-42',
        path: '/api/admin/plans',
      },
      async () => {
        return sampleUseCase();
      }
    );

    expect(result.reqId).toBe(customReqId);
    expect(result.corrId).toBe(customCorrId);
    expect(result.ctx?.userId).toBe('user-42');
    expect(result.ctx?.path).toBe('/api/admin/plans');
  });

  it('createAuditLog automatically inherits ambient correlationId and requestId from context', async () => {
    mockDb.auditLog.create.mockResolvedValue({ id: 'log-1' });

    await runWithRequestContext(
      {
        requestId: 'req-audit-999',
        correlationId: 'corr-audit-999',
      },
      async () => {
        await createAuditLog({
          actorId: 'admin-1',
          action: 'plan.update',
          entity: 'plan',
          entityId: 'plan-1',
          details: { actionName: 'update_plan' },
        });
      }
    );

    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
    const callArgs = mockDb.auditLog.create.mock.calls[0][0];
    const details = JSON.parse(callArgs.data.details);

    expect(details.actionName).toBe('update_plan');
    expect(details.correlationId).toBe('corr-audit-999');
    expect(details.requestId).toBe('req-audit-999');
  });
});
