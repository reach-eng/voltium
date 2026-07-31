import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { paiseToRupees, rupeesToPaise } from '@/lib/flatten-rider';
import { createAuditLog } from '@/lib/audit-log';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { NotFoundError, ValidationError } from "@/lib/api-error";

export function getDurationForPlanType(type: string): number {
  const t = type.toUpperCase();
  if (t === 'DAILY') return 1;
  if (t === 'WEEKLY') return 7;
  if (t === 'MONTHLY') return 30;
  return 7;
}

export const planUseCases = {
  async list(page: number, limit: number) {
    const [plans, total] = await Promise.all([
      db.rentalPlan.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.rentalPlan.count(),
    ]);
    const formatted = plans.map((p: { price: number; [key: string]: unknown }) => ({
      ...p,
      price: paiseToRupees(p.price),
    }));
    return {
      plans: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async listActivePlans() {
    return getOrSetResponse('rental_plans', async () => {
      const plans = await db.rentalPlan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });
      return plans.map((p: { price: number; [key: string]: unknown }) => ({
        ...p,
        price: paiseToRupees(p.price),
      }));
    }, 3600);
  },

  async subscribeToPlan(riderDbId: string, planId: string, advanceRentPaid = false) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { wallet: true },
    });
    if (!rider) throw new NotFoundError('Rider not found');
    const plan = await db.rentalPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError('Plan not found');
    if (!plan.isActive) throw new ValidationError('Plan is not active');
    
    // According to rider-lifecycle, the user goes GUARANTOR_APPROVED -> PLAN_SELECTED -> DEPOSIT_PENDING -> DEPOSIT_APPROVED.
    if (
      !['GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED', 'PLAN_SELECTED', 'DEPOSIT_PENDING', 'DEPOSIT_APPROVED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'PICKUP_SCHEDULED', 'ACTIVE'].includes(
        rider.lifecycleStatus
      )
    )
      throw new ValidationError('INVALID_STATE_FOR_PLAN_SELECTION');

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const priceInPaise = plan.price;
    const currentBalance = rider.wallet?.balanceInPaise ?? 0;

    if (currentBalance < priceInPaise) {
      throw new ValidationError('INSUFFICIENT_BALANCE');
    }

    await walletLedgerService.debit({
      riderId: riderDbId,
      amountInPaise: priceInPaise,
      category: 'RENT_PAYMENT',
    });

    await db.rider.update({
      where: { id: riderDbId },
      data: {
        lifecycleStatus: 'PLAN_SELECTED',
        currentPlan: plan.name,
        currentPlanPrice: plan.price,
        planStartDate: now,
        planEndDate: endDate,
      },
    });

    return {
      planId: plan.id,
      planName: plan.name,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      durationDays: plan.durationDays,
      price: paiseToRupees(plan.price),
    };
  },

  async create(
    data: { name: string; type: string; price: number; durationDays?: number; description?: string; securityDeposit?: number; isSecurityRefundable?: boolean; refundableAfterDays?: number | null; additionalInfo?: string | null },
    actorId: string
  ) {
    const computedDuration = getDurationForPlanType(data.type);
    const plan = await db.rentalPlan.create({
      data: {
        name: data.name,
        type: data.type as 'DAILY' | 'WEEKLY' | 'MONTHLY',
        price: rupeesToPaise(Number(data.price)),
        securityDeposit: data.securityDeposit != null ? rupeesToPaise(Number(data.securityDeposit)) : 0,
        isSecurityRefundable: data.isSecurityRefundable ?? true,
        refundableAfterDays: data.refundableAfterDays ?? null,
        durationDays: computedDuration,
        description: data.description || null,
        additionalInfo: data.additionalInfo || null,
        isActive: true,
      },
    });
    invalidateCache('rental_plans*');
    invalidateCache('rider_plans*');
    createAuditLog({
      actorId,
      action: 'plan.create',
      entity: 'plan',
      entityId: plan.id,
      details: { name: data.name, type: data.type },
    }).catch(() => {});
    return { ...plan, price: paiseToRupees(plan.price) };
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    if (data.price != null) data.price = rupeesToPaise(Number(data.price));
    if (data.securityDeposit != null) data.securityDeposit = rupeesToPaise(Number(data.securityDeposit));
    
    // Strictly prevent manual durationDays mutation outside plan type
    delete data.durationDays;
    if (data.type != null) {
      data.durationDays = getDurationForPlanType(String(data.type));
    }

    const plan = await db.rentalPlan.update({ where: { id }, data });
    invalidateCache('rental_plans*');
    invalidateCache('rider_plans*');
    createAuditLog({
      actorId,
      action: 'plan.update',
      entity: 'plan',
      entityId: id,
      details: data,
    }).catch(() => {});
    return { ...plan, price: paiseToRupees(plan.price) };
  },

  async delete(id: string, actorId: string) {
    await db.rentalPlan.delete({ where: { id } });
    invalidateCache('rental_plans*');
    invalidateCache('rider_plans*');
    createAuditLog({ actorId, action: 'plan.delete', entity: 'plan', entityId: id }).catch(
      () => {}
    );
  },
};
