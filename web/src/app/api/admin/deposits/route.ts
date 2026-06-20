import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { logAdminAction } from '@/server/modules/admin/admin.policy';
import { depositUseCases } from '@/server/modules/deposits/deposit.use-cases';
import { DepositStateError } from '@/lib/services/deposit-service';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const riderId = url.searchParams.get('riderId') || '';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const result = await depositUseCases.listDeposits({
      status,
      riderId,
      startDate,
      endDate,
      page,
      limit,
    });

    return success(result.records, undefined, 200, result.pagination);
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
        return success({ riderId, status: 'FORFEITED' }, 'Deposit forfeited');

      default:
        return errors.badRequest(
          `Unknown action: ${action}. Use APPROVE | REJECT | REFUND | FORFEIT`
        );
    }
  } catch (err) {
    if (err instanceof DepositStateError) return errors.conflict(err.message);
    return errors.internal('Failed to process deposit action');
  }
}

// Compatibility for generated clients that submit deposit actions with POST.
export const POST = PUT;
