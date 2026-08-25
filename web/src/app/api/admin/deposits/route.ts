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
import { z } from 'zod';

import { invalidateCache } from '@/lib/cache';

// AUDIT FIX (N-7): the PUT body was destructured raw — refundAmount /
// bonusAmount flowed straight into `Math.round(x*100)` paise math with no
// sign/type/bounds/precision checks (negative refund? NaN? float drift?).
const MoneyRupees = z
  .number()
  .finite({ message: 'amount must be a finite number' })
  .positive('amount must be positive')
  .max(10_000_000, 'amount exceeds the maximum allowed')
  .refine((v) => Number.isInteger(Math.round(v * 100)), {
    message: 'amount supports at most 2 decimal places',
  });

// Route modules may only export handlers — schema stays file-local.
const DepositActionSchema = z
  .object({
    riderId: z.string().min(1),
    action: z.enum(['APPROVE', 'REJECT', 'REFUND', 'FORFEIT']),
    reason: z.string().min(1).max(1000).optional(),
    refundAmount: MoneyRupees.optional(),
    bonusAmount: MoneyRupees.optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.action === 'REJECT' || v.action === 'FORFEIT') && !v.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: `reason is required for ${v.action}`,
      });
    }
  });

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'transactions_view')) return adminForbidden();

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
  if (!hasPermission(session, 'transactions_approve')) return adminForbidden();

  try {
    const raw = await req.json();
    // AUDIT FIX (N-7): validated + typed body (see DepositActionSchema).
    const parsed = DepositActionSchema.safeParse(raw);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
      );
    }
    // `bonusAmount` is accepted-but-unused today (no consumer in the
    // use-cases); it stays validated so clients can't smuggle junk.
    const { riderId, action, reason, refundAmount } = parsed.data;

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
        invalidateCache('admin:wallets:*');
        invalidateCache('admin:riders:*');
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
        invalidateCache('admin:wallets:*');
        invalidateCache('admin:riders:*');
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
        invalidateCache('admin:wallets:*');
        invalidateCache('admin:riders:*');
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
        invalidateCache('admin:wallets:*');
        invalidateCache('admin:riders:*');
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
