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
    const { ids, action, value } = body;

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
        for (const id of ids) {
          try {
            await adminRiderUseCases.update(
              id,
              { accountStatus: value },
              { actorId: adminId, actorRole: session.adminRole || '' }
            );
            updatedCount++;
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? e.message : String(e) });
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
            failures.push({ id, error: e instanceof Error ? e.message : String(e) });
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
                rejectionReason: kycStatus !== 'APPROVED' ? 'Bulk action' : undefined,
              },
              { actorId: adminId, actorRole: session.adminRole || '' }
            );
            updatedCount++;
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? e.message : String(e) });
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
