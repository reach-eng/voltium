/**
 * Soft Delete Utility
 * Provides soft delete functionality with audit trails for compliance
 */

import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export interface SoftDeleteOptions {
  deletedBy: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface SoftDeleteResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Perform a soft delete on a record
 * Creates audit log entry before marking as deleted
 */
export async function softDelete<T = any>(
  model: string,
  id: string,
  options: SoftDeleteOptions
): Promise<SoftDeleteResult<T>> {
  const now = new Date();

  try {
    // Create audit log BEFORE deletion
    await createAuditLog({
      actorId: options.deletedBy,
      actorType: 'ADMIN',
      action: 'DELETE',
      entity: model,
      entityId: id,
      details: JSON.stringify({
        reason: options.reason,
        timestamp: now.toISOString(),
        metadata: options.metadata,
      }),
    });

    // Perform soft delete based on model type
    let result: any;

    switch (model) {
      case 'Rider':
        result = await db.rider.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      case 'Transaction':
        result = await db.transaction.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      case 'Admin':
        result = await db.admin.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      case 'SupportTicket':
        result = await db.supportTicket.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      case 'Vehicle':
        result = await db.vehicle.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      case 'Hub':
        result = await db.hub.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      case 'RentalLease':
        result = await db.rentalLease.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      case 'Guarantor':
        result = await db.guarantor.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: options.deletedBy,
            deletionReason: options.reason,
          },
        });
        break;

      default:
        return {
          success: false,
          error: `Soft delete not configured for model: ${model}`,
        };
    }

    logger.info(`[SoftDelete] ${model} soft-deleted`, {
      id,
      deletedBy: options.deletedBy,
      reason: options.reason,
    });

    return { success: true, data: result };
  } catch (error) {
    logger.error(`[SoftDelete] Failed to soft-delete ${model}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Restore a soft-deleted record
 */
export async function restoreSoftDelete<T = any>(
  model: string,
  id: string,
  restoredBy: string
): Promise<SoftDeleteResult<T>> {
  try {
    // Create audit log for restoration
    await createAuditLog({
      actorId: restoredBy,
      actorType: 'ADMIN',
      action: 'RESTORE',
      entity: model,
      entityId: id,
      details: JSON.stringify({
        timestamp: new Date().toISOString(),
      }),
    });

    const updateData = {
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
    };

    let result: any;

    switch (model) {
      case 'Rider':
        result = await db.rider.update({
          where: { id },
          data: updateData,
        });
        break;

      case 'Transaction':
        result = await db.transaction.update({
          where: { id },
          data: updateData,
        });
        break;

      case 'Admin':
        result = await db.admin.update({
          where: { id },
          data: updateData,
        });
        break;

      case 'SupportTicket':
        result = await db.supportTicket.update({
          where: { id },
          data: updateData,
        });
        break;

      case 'Vehicle':
        result = await db.vehicle.update({
          where: { id },
          data: updateData,
        });
        break;

      case 'Hub':
        result = await db.hub.update({
          where: { id },
          data: updateData,
        });
        break;

      case 'RentalLease':
        result = await db.rentalLease.update({
          where: { id },
          data: updateData,
        });
        break;

      case 'Guarantor':
        result = await db.guarantor.update({
          where: { id },
          data: updateData,
        });
        break;

      default:
        return {
          success: false,
          error: `Restore not configured for model: ${model}`,
        };
    }

    logger.info(`[SoftDelete] ${model} restored`, { id, restoredBy });

    return { success: true, data: result };
  } catch (error) {
    logger.error(`[SoftDelete] Failed to restore ${model}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper to filter out soft-deleted records from queries
 * Usage: db.rider.findMany(includeDeleted(query, false))
 */
export function includeDeleted(
  query: any,
  includeDeleted: boolean = false
): any {
  if (includeDeleted) {
    return query;
  }

  return {
    ...query,
    where: {
      ...(query.where || {}),
      deletedAt: null,
    },
  };
}

/**
 * Get deletion history for auditing
 */
export async function getDeletionHistory(
  model: string,
  limit: number = 100
) {
  try {
    const history = await db.auditLog.findMany({
      where: {
        entity: model,
        action: 'DELETE',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return history;
  } catch (error) {
    logger.error(`[SoftDelete] Failed to get deletion history:`, error);
    return [];
  }
}

/**
 * Permanently delete soft-deleted records (data retention policy)
 * Should only be called after retention period expires
 */
export async function permanentlyDeleteExpired(
  model: string,
  retentionDays: number = 90
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    let deletedCount = 0;

    switch (model) {
      case 'Rider':
        const riderResult = await db.rider.deleteMany({
          where: {
            deletedAt: { lt: cutoffDate },
          },
        });
        deletedCount = riderResult.count;
        break;

      case 'Transaction':
        const txnResult = await db.transaction.deleteMany({
          where: {
            deletedAt: { lt: cutoffDate },
          },
        });
        deletedCount = txnResult.count;
        break;

      // ... other models
    }

    logger.info(`[SoftDelete] Permanently deleted ${deletedCount} expired ${model} records`);
    return deletedCount;
  } catch (error) {
    logger.error(`[SoftDelete] Failed to permanently delete expired records:`, error);
    return 0;
  }
}
