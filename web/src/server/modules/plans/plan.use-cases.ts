import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { paiseToRupees, rupeesToPaise } from '@/lib/flatten-rider';
import { createAuditLog } from '@/lib/audit-log';
import { invalidateCache } from '@/lib/cache';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';

/**
 * Calculates strict duration in days for a given plan type.
 * Business Rule: DAILY = 1, WEEKLY = 7, MONTHLY = 30.
 * Defaults to 7 for unrecognized plan types.
 */
export function getDurationForPlanType(planType?: string | null): number {
  if (!planType) return 7;
  const upper = planType.toUpperCase();
  switch (upper) {
    case 'DAILY':
      return 1;
    case 'WEEKLY':
      return 7;
    case 'MONTHLY':
      return 30;
    default:
      return 7;
  }
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
    const plans = await db.rentalPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
    return plans.map((p: { price: number; [key: string]: unknown }) => ({
      ...p,
      price: paiseToRupees(p.price),
    }));
  },

  async subscribeToPlan(riderDbId: string, planId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { wallet: true },
    });
    if (!rider) throw new Error('Rider not found');
    const plan = await db.rentalPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');
    if (!plan.isActive) throw new Error('Plan is not active');
    
    // According to rider-lifecycle, the user goes GUARANTOR_APPROVED -> PLAN_SELECTED -> DEPOSIT_PENDING -> DEPOSIT_APPROVED.
    // So if they are in GUARANTOR_APPROVED or GUARANTOR_SUBMITTED, they can select a plan.
    if (
      !['GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED', 'PLAN_SELECTED', 'DEPOSIT_PENDING', 'DEPOSIT_APPROVED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'PICKUP_SCHEDULED', 'ACTIVE'].includes(
        rider.lifecycleStatus
      )
    )
      throw new Error('INVALID_STATE_FOR_PLAN_SELECTION');

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.rider.update({
        where: { id: riderDbId },
        data: {
          lifecycleStatus: 'PLAN_SELECTED',
          currentPlan: plan.name,
          currentPlanPrice: plan.price,
          planStartDate: now,
          planEndDate: endDate,
          planDoneAt: new Date(),
        },
      });
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
    const computedDuration = data.type === 'DAILY' ? 1 : data.type === 'WEEKLY' ? 7 : 30;
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
    const updateData = { ...data };
    delete updateData.durationDays;
    if (updateData.price != null) updateData.price = rupeesToPaise(Number(updateData.price));
    if (updateData.securityDeposit != null) updateData.securityDeposit = rupeesToPaise(Number(updateData.securityDeposit));
    if (updateData.type != null) {
      updateData.durationDays = getDurationForPlanType(String(updateData.type));
    }
    const plan = await db.rentalPlan.update({ where: { id }, data: updateData });
    invalidateCache('rental_plans*');
    invalidateCache('rider_plans*');
    createAuditLog({
      actorId,
      action: 'plan.update',
      entity: 'plan',
      entityId: id,
      details: updateData,
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
