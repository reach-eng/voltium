import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { parseDDMMYYYY } from '@/lib/date-utils';
import { logAdminAction } from '@/server/modules/admin/admin.policy';
import { depositUseCases } from '@/server/modules/deposits/deposit.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';
import { DepositStateError } from '@/lib/services/deposit-service';
import { toRupeesResponse } from '@/lib/api-money';

import { invalidateCache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const riderId = url.searchParams.get('riderId') || '';
    // Accept both DD-MM-YYYY (canonical) and ISO 8601 (legacy).
    const startDateRaw = url.searchParams.get('startDate') || '';
    const endDateRaw = url.searchParams.get('endDate') || '';
    const startDate = startDateRaw
      ? parseDDMMYYYY(startDateRaw)?.toISOString() || startDateRaw
      : '';
    const endDate = endDateRaw
      ? parseDDMMYYYY(endDateRaw)?.toISOString() || endDateRaw
      : '';
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const result = await depositUseCases.listDeposits({
      status,
      riderId,
      startDate,
      endDate,
      page,
      limit,
    });

    return withCacheHeaders(success(toRupeesResponse(result.records), undefined, 200, result.pagination), 5);
  } catch (err) {
    return errors.internal('Failed to fetch deposit records');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_approve')) return adminForbidden();

  try {
    const body = await req.json();
    const { riderId, action, reason, refundAmount, bonusAmount } = body;
    if (!riderId || !action) return errors.badRequest('riderId and action are required');

    const adminId = session.adminId || '';

    switch (action) {
      case 'APPROVE':
        await depositUseCases.reviewDeposit(riderId, adminId, { action: 'APPROVE' });
        await logAdminAction({
          actorId: adminId,
          action: 'deposit.approve',
          entity: 'depositRecord',
          entityId: riderId,
          details: { action },
        }).catch(() => {});
        invalidateCache('admin:deposits:*');
        invalidateCache('admin:*');
        return success({ riderId, status: 'APPROVED' }, 'Deposit approved');

      case 'REJECT':
        if (!reason) return errors.badRequest('reason is required for REJECT');
        await depositUseCases.reviewDeposit(riderId, adminId, {
          action: 'REJECT',
          rejectionReason: reason,
        });
        await logAdminAction({
          actorId: adminId,
          action: 'deposit.reject',
          entity: 'depositRecord',
          entityId: riderId,
          details: { action, reason },
        }).catch(() => {});
        invalidateCache('admin:deposits:*');
        invalidateCache('admin:*');
        return success({ riderId, status: 'REJECTED' }, 'Deposit rejected');

      case 'REFUND':
        await depositUseCases.requestRefund(
          riderId,
          adminId,
          refundAmount ? Math.round(refundAmount * 100) : undefined
        );
        await logAdminAction({
          actorId: adminId,
          action: 'deposit.refund',
          entity: 'depositRecord',
          entityId: riderId,
          details: { action, refundAmount },
        }).catch(() => {});
        invalidateCache('admin:deposits:*');
        invalidateCache('admin:*');
        return success({ riderId, status: 'REFUNDED' }, 'Deposit refunded');

      case 'FORFEIT':
        if (!reason) return errors.badRequest('reason is required for FORFEIT');
        await depositUseCases.forfeitDeposit(riderId, adminId, reason);
        await logAdminAction({
          actorId: adminId,
          action: 'deposit.forfeit',
          entity: 'depositRecord',
          entityId: riderId,
          details: { action, reason },
        }).catch(() => {});
        invalidateCache('admin:deposits:*');
        invalidateCache('admin:*');
        return success({ riderId, status: 'FORFEITED' }, 'Deposit forfeited');

      default:
        return errors.badRequest(
          `Unknown action: ${action}. Use APPROVE | REJECT | REFUND | FORFEIT`
        );
    }
  } catch (err) {
    if (err instanceof DepositStateError) return errors.conflict((err instanceof Error ? err.message : String(err)));
    return errors.internal('Failed to process deposit action');
  }
}

// Compatibility for generated clients that submit deposit actions with POST.
export const POST = PUT;
