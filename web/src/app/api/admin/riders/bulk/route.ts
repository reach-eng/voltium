/**
 * POST /api/admin/riders/bulk — Bulk rider actions
 *
 * Thin route handler: auth + parse + call use-case + respond.
 * Business logic lives in adminRiderUseCases (bulk status update, bulk delete, bulk KYC).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { withIdempotency } from '@/lib/api-middleware';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

async function postHandler(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();

    const body = await req.json();
    const { ids, action, value, rejectionReason, editableFields } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errors.badRequest('ids must be a non-empty array');
    }

    const requiredPerm = action === 'delete' ? 'riders_delete' : 'riders_update';
    if (!hasPermission(session, requiredPerm as any)) return adminForbidden();

    const adminId = session.adminId || session.riderDbId;
    let updatedCount = 0;
    const failures: { id: string; error: string }[] = [];

    switch (action) {
      case 'updateStatus': {
        // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): `accountStatus`
        // is a virtual field computed in `flattenRider` — it
        // is not a column on the Rider model. Map the bulk
        // status update to the real `lifecycleStatus` column
        // so the write actually persists. The Zod schema
        // (`updateRiderSchema.lifecycleStatus`) accepts the
        // full `RiderLifecycleStatus` enum.
        for (const id of ids) {
          try {
            await adminRiderUseCases.update(
              id,
              { lifecycleStatus: value },
              { actorId: adminId, actorRole: session.adminRole || '' }
            );
            updatedCount++;
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e) });
          }
        }
        break;
      }

      case 'delete': {
        for (const id of ids) {
          try {
            await adminRiderUseCases.delete(id);
            updatedCount++;
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e) });
          }
        }
        break;
      }

      case 'bulkKyc': {
        const kycStatus = value as 'APPROVED' | 'REJECTED' | 'INFO_REQUIRED';
        for (const id of ids) {
          try {
            await adminRiderUseCases.update(
              id,
              {
                kycStatus,
                // KYC-CORRECTION-P0-2026-09-08 (P0-1): forward the
                // admin-supplied reason (was hardcoded to "Bulk
                // action" — useless for audit). Also forward the
                // editableFields allowlist so the bulk action
                // doesn't permanently lock out all selected riders.
                rejectionReason:
                  kycStatus !== 'APPROVED'
                    ? typeof rejectionReason === 'string' && rejectionReason.trim()
                      ? rejectionReason.trim()
                      : 'Bulk action'
                    : undefined,
                editableFields:
                  kycStatus !== 'APPROVED' && Array.isArray(editableFields)
                    ? editableFields
                    : undefined,
              },
              { actorId: adminId, actorRole: session.adminRole || '' }
            );
            updatedCount++;
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e) });
          }
        }
        break;
      }

      default:
        return errors.badRequest('Invalid action');
    }

    return success({ count: updatedCount, failures }, 'Bulk action completed');
  } catch (error) {
    logger.error('[BULK_ACTION_ERROR]', error);
    return errors.internal('Failed to process bulk action');
  }
}

export const POST = (req: NextRequest) => withIdempotency(postHandler)(req);
export async function GET() {
  return success({ message: 'Bulk rider API endpoint' });
}
