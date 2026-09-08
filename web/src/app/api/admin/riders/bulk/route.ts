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
import { validateBody, bulkActionSchema } from '@/lib/validators';
import { invalidateCache } from '@/lib/cache';
import { createAuditLog } from '@/lib/audit-log';
import { ALL_KYC_DOCUMENT_KEYS } from '@/server/modules/kyc/kyc.types';

async function postHandler(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();

    const body = await req.json();
    const validation = validateBody(bulkActionSchema, body);
    if (!validation.success) {
      return errors.badRequest(validation.error);
    }

    const { ids, action, value, rejectionReason } = validation.data;

    if (action === 'delete') {
      if (!hasPermission(session, 'riders_delete')) return adminForbidden();
    } else if (action === 'bulkKyc') {
      if (!hasPermission(session, 'kyc_bulk_approve') && !hasPermission(session, 'kyc_approve')) {
        return adminForbidden();
      }
    } else {
      if (!hasPermission(session, 'riders_update')) return adminForbidden();
    }

    const adminId = session.adminId || session.riderDbId;
    let updatedCount = 0;
    const failures: { id: string; error: string }[] = [];

    switch (action) {
      case 'suspend': {
        for (const id of ids) {
          try {
            await adminRiderUseCases.suspend(id, {
              actorId: adminId || 'unknown',
              actorRole: session.adminRole || '',
              reason: typeof value === 'string' ? value : undefined,
            });
            updatedCount++;
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? e.message : String(e) });
          }
        }
        break;
      }

      case 'updateStatus': {
        // ADMIN-RIDER-AUDIT P0-1 (2026-09-08):
        // If value is 'SUSPENDED', route to adminRiderUseCases.suspend
        // (deliberate machine bypass — admin override, ticket-revert precedent).
        // Otherwise, map status update to the real `lifecycleStatus` column
        // via adminRiderUseCases.update.
        if (value === 'SUSPENDED') {
          for (const id of ids) {
            try {
              await adminRiderUseCases.suspend(id, {
                actorId: adminId || 'unknown',
                actorRole: session.adminRole || '',
                reason: 'Bulk suspend',
              });
              updatedCount++;
            } catch (e) {
              failures.push({ id, error: e instanceof Error ? e.message : String(e) });
            }
          }
        } else {
          for (const id of ids) {
            try {
              await adminRiderUseCases.update(
                id,
                { lifecycleStatus: value },
                { actorId: adminId, actorRole: session.adminRole || '' }
              );
              updatedCount++;
            } catch (e) {
              failures.push({ id, error: e instanceof Error ? e.message : String(e) });
            }
          }
        }
        break;
      }

      case 'delete': {
        // NET-005 follow-up-18 (2026-09-08): the previous
        // code called `adminRiderUseCases.delete(id)` with
        // NO actor. The use-case's in-transaction audit
        // row then wrote `actorId: 'system', actorType:
        // 'SYSTEM'` — and unlike the single DELETE route,
        // the bulk route did NOT write a second
        // route-level audit row to compensate. So bulk
        // deletes left only the SYSTEM row as evidence.
        // Thread the real admin id through; the use-case
        // now requires it.
        if (!adminId) {
          return errors.unauthorized('Admin session has no actor id');
        }
        for (const id of ids) {
          try {
            await adminRiderUseCases.delete(id, adminId);
            updatedCount++;
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e) });
          }
        }
        break;
      }

      case 'bulkKyc': {
        const kycStatus = value as 'APPROVED' | 'REJECTED' | 'INFO_REQUIRED';
        // NET-005 follow-up-11 (2026-09-08): the bulk
        // KYC route used to hardcode `rejectionReason:
        // 'Bulk action'` regardless of what the admin
        // typed in the bulk dialog. The dialog enforces
        // 10+ chars for reject and 5+ chars for
        // info_required, and the frontend sends the
        // reason in the body (useKyc.ts:232), but the
        // route silently dropped it. Result: the
        // rider's `KYC_REJECTED` / `KYC_INFO_REQUESTED`
        // notification and the KycProfile.rejectionReason
        // column both carried the literal "Bulk action"
        // instead of the admin's actual text. Read the
        // body field and propagate it; fall back to a
        // per-action generic only when the caller omits
        // it (non-UI callers, scripts, idempotent replays
        // of pre-fix requests).
        const trimmedReason =
          typeof rejectionReason === 'string' && rejectionReason.trim().length > 0
            ? rejectionReason.trim()
            : undefined;

        // P1-1: Validate minimum reason lengths matching the UI constraints
        // when a reason is provided. Fallback generics apply when omitted.
        if (kycStatus === 'REJECTED' && trimmedReason && trimmedReason.length < 10) {
          return errors.badRequest('Rejection reason must be at least 10 characters');
        }
        if (kycStatus === 'INFO_REQUIRED' && trimmedReason && trimmedReason.length < 5) {
          return errors.badRequest('Correction details must be at least 5 characters');
        }

        // APPROVED never carries a rejection reason (the dialog
        // doesn't expose one, and the pre-fix code hardcoded
        // `undefined` for it). For REJECTED and INFO_REQUIRED,
        // use the body field if present, else fall back to a
        // per-action generic — the fallback covers non-UI callers
        // (scripts, idempotent replays of pre-fix requests) that
        // don't pass `rejectionReason` at all.
        const finalReason =
          kycStatus === 'APPROVED'
            ? undefined
            : trimmedReason ??
              (kycStatus === 'REJECTED'
                ? 'Bulk rejection'
                : 'Bulk info request');
        for (const id of ids) {
          try {
            await adminRiderUseCases.update(
              id,
              {
                kycStatus,
                ...(finalReason !== undefined ? { rejectionReason: finalReason } : {}),
                ...(kycStatus === 'REJECTED' || kycStatus === 'INFO_REQUIRED'
                  ? { editableFields: Array.from(ALL_KYC_DOCUMENT_KEYS) }
                  : {}),
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

    // Invalidate admin cache after bulk modifications to prevent list staleness
    invalidateCache('admin:*');

    // Write batch audit log for bulk operations (P1-6)
    createAuditLog({
      actorId: adminId || 'unknown',
      action: `rider.bulk_${action}`,
      entity: 'rider',
      entityId: 'multiple',
      details: {
        ids,
        count: updatedCount,
        failedCount: failures.length,
        action,
        value,
      },
    }).catch((err) => {
      logger.error('Failed to create bulk action audit log', { error: err });
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
