import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { AuditActionType } from '@prisma/client';

export const RETENTION_PERIODS: Record<string, number> = {
  auth: 90,
  kyc: 365,
  rider_update: 180,
  bulk_action: 365,
  system: 30,
};

const DEFAULT_RETENTION_DAYS = 90;

function getRetentionDays(action: string): number {
  const actionType = action.split('.')[0];
  return RETENTION_PERIODS[actionType] ?? DEFAULT_RETENTION_DAYS;
}

export function getExpiresAt(action: string): Date {
  const days = getRetentionDays(action);
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

const CRITICAL_ACTIONS = new Set<string>([
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'PERMISSION_CHANGE',
  'ROLE_CHANGE',
  'SYSTEM_CONFIG',
]);

export async function createAuditLog(params: {
  actorId: string;
  actorType?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorType: (params.actorType || 'ADMIN') as 'ADMIN' | 'SYSTEM' | 'RIDER',
        action: params.action as AuditActionType,
        entity: params.entity,
        entityId: params.entityId || null,
        details:
          typeof params.details === 'string'
            ? params.details
            : params.details
              ? JSON.stringify(params.details)
              : null,
        expiresAt: getExpiresAt(params.action),
      },
    });
  } catch (err: any) {
    logger.error('[AuditLog] Failed to create entry:', err);
    if (CRITICAL_ACTIONS.has(params.action)) {
      throw new Error(`Audit log write failed for critical action ${params.action}: ${err?.message || err}`);
    }
    console.error('[AUDIT_FAILED]', JSON.stringify(params), err?.message || err);
  }
}

export async function getExpiredLogs(): Promise<number> {
  try {
    const count = await db.auditLog.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return count;
  } catch (err) {
    logger.error('[AuditLog] Failed to count expired logs:', err);
    return 0;
  }
}

export async function deleteExpiredLogs(): Promise<number> {
  try {
    const result = await db.auditLog.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    if (result.count > 0) {
      logger.info(`[AuditLog] Deleted ${result.count} expired audit logs`);
    }
    return result.count;
  } catch (err) {
    logger.error('[AuditLog] Failed to delete expired logs:', err);
    return 0;
  }
}

export async function getRetentionStats(): Promise<Record<string, unknown>> {
  try {
    const now = new Date();
    const buckets = [
      { label: '0-7 days', days: 7 },
      { label: '7-30 days', days: 30 },
      { label: '30-90 days', days: 90 },
      { label: '90-180 days', days: 180 },
      { label: '180-365 days', days: 365 },
      { label: '365+ days', days: 9999 },
    ];

    const stats: Record<string, number> = {};
    let prevDate: Date | null = null;

    for (const bucket of buckets) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - bucket.days);

      const count = await db.auditLog.count({
        where: {
          createdAt: {
            gte: cutoff,
            lt: prevDate || now,
          },
          expiresAt: {
            gt: now,
          },
        },
      });

      stats[bucket.label] = count;
      prevDate = cutoff;
    }

    const expiredCount = await getExpiredLogs();

    return {
      active: stats,
      expired: expiredCount,
      retentionPeriods: RETENTION_PERIODS,
    };
  } catch (err) {
    logger.error('[AuditLog] Failed to get retention stats:', err);
    return { error: 'Failed to compute stats' };
  }
}
