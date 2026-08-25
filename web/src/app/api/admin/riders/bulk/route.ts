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
import { z } from 'zod';
import { logAdminMutation } from '@/lib/audit-log';

// AUDIT FIX (N-7): `ids` / `action` / `value` were destructured raw into
// bulk rider mutations. Now schema-validated with a hard cap on batch size.
const BulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['updateStatus', 'delete', 'bulkKyc']),
  value: z.union([z.string().max(30), z.undefined()]),
});

async function postHandler(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();

    const body = await req.json();
    const parsed = BulkActionSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
      );
    }
    const { ids, action } = parsed.data;
    const value = parsed.data.value as string | undefined;

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
        // AUDIT FIX (N-7): value is validated against the KYC state enum
        // instead of a blind cast.
        const parsedKyc = z
          .enum(['APPROVED', 'REJECTED', 'INFO_REQUIRED'])
          .safeParse(value);
        if (!parsedKyc.success) {
          return errors.badRequest(
            'bulkKyc requires value: APPROVED | REJECTED | INFO_REQUIRED'
          );
        }
        const kycStatus = parsedKyc.data;
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
            failures.push({ id, error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e) });
          }
        }
        break;
      }

      default:
        return errors.badRequest('Invalid action');
    }

    await logAdminMutation({
      session,
      action: `rider.bulk_${action}`,
      entity: 'Rider',
      details: {
        total: ids.length,
        updatedCount,
        failedCount: failures.length,
        action,
        value,
      },
    });

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
