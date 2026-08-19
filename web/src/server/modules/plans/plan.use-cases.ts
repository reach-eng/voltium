import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { paiseToRupees, rupeesToPaise } from '@/lib/flatten-rider';
import { createAuditLog } from '@/lib/audit-log';
import { invalidateCache } from '@/lib/cache';
import { invalidateRiderCache } from '@/lib/server-cache';

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
  // P1.9: soft-deleted plans must not appear in admin lists.
  async list(page: number, limit: number, search?: string | null) {
    // PR-9 (2026-08-06 fix plan): server-side search on the plans screen.
    const where = search?.trim()
      ? {
          deletedAt: null,
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' as const } },
            {
              description: {
                contains: search.trim(),
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : { deletedAt: null };
    const [plans, total] = await Promise.all([
      db.rentalPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.rentalPlan.count({ where }),
    ]);
    const formatted = plans.map((p: Record<string, any>) => ({
      ...p,
      price: paiseToRupees(p.priceInPaise),
      securityDeposit: paiseToRupees(p.securityDepositInPaise),
    }));
    return {
      plans: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // P1.9: soft-deleted plans must not appear in the rider plan picker.
  async listActivePlans() {
    const plans = await db.rentalPlan.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { priceInPaise: 'asc' },
    });
    return plans.map((p: Record<string, any>) => ({
      ...p,
      price: paiseToRupees(p.priceInPaise),
      securityDeposit: paiseToRupees(p.securityDepositInPaise),
    }));
  },

  async subscribeToPlan(riderDbId: string, planId: string, advanceRentPaid?: boolean) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { wallet: true },
    });
    if (!rider) throw new Error('Rider not found');
    const plan = await db.rentalPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');
    if (!plan.isActive) throw new Error('Plan is not active');
    
    if (
      // PR-ONBOARDING-2026-08-11 (audit 2.13): NO_RENTAL and NEW are valid
      // entry points (brand-new riders, or riders who closed their prior
      // rental and are re-subscribing). Without these, a brand-new rider
      // cannot reach PLAN_SELECTED via the normal path; the only way was
      // the dev-only `autoProvisionTestRider` flow. CLOSED and SUSPENDED
      // remain excluded — closed accounts cannot re-subscribe and
      // suspended riders need admin intervention first.
      !['NEW', 'NO_RENTAL', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED', 'PLAN_SELECTED', 'DEPOSIT_PENDING', 'DEPOSIT_APPROVED', 'PICKUP_SCHEDULED', 'ACTIVE', 'RETURN_PENDING', 'RETURN_APPROVED'].includes(
        rider.lifecycleStatus
      )
    )
      throw new Error('INVALID_STATE_FOR_PLAN_SELECTION');

    // P3.14 (2026-08-05 rentals/vehicles/hubs audit): allowing KYC_* states
    // here is the RE-SUBSCRIPTION path — a rider who already completed KYC on
    // a prior plan can switch plans mid-flow. The use-case overwrites
    // currentPlan/planEndDate for the new plan, which is the intended
    // behavior; leases created under the old plan keep their own pricing.
    // A future `changePlan` use-case could formalize this, but the explicit
    // re-subscription semantics are documented here rather than silently
    // restricting the rider flow.

    const now = new Date();
    const endDate = new Date(now);
    // P2.1: durationDays is strictly derived from type (DAILY=1, WEEKLY=7,
    // MONTHLY=30) — the DB column is only a sanity-check cache. Never trust
    // it for billing math; a mis-seeded row must not mis-price a rider.
    endDate.setDate(endDate.getDate() + getDurationForPlanType(plan.type));

    await db.$transaction(async (tx) => {
      await tx.rider.update({
        where: { id: riderDbId },
        data: {
          lifecycleStatus: 'PLAN_SELECTED',
          currentPlan: plan.name,
          currentPlanId: plan.id,
          currentPlanPrice: plan.priceInPaise,
          ...(advanceRentPaid !== undefined ? { advanceRentPaid: Boolean(advanceRentPaid) } : {}),
          planStartDate: now,
          planEndDate: endDate,
          planDoneAt: new Date(),
        },
      });
    });
    // PR-ONBOARDING-2026-08-11 (audit 2.15): invalidate the rider cache so
    // the dashboard / status views pick up the new plan immediately. Without
    // this, cached `currentPlan` survives until TTL expiry and a rider
    // re-subscribing sees their old plan in the UI until the next refresh.
    invalidateRiderCache(riderDbId);
    return {
      planId: plan.id,
      planName: plan.name,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      durationDays: getDurationForPlanType(plan.type),
      price: paiseToRupees(plan.priceInPaise),
      securityDeposit: paiseToRupees(plan.securityDepositInPaise),
    };
  },

  async create(
    data: { name: string; type: string; price: number; durationDays?: number; description?: string; securityDeposit?: number; isSecurityRefundable?: boolean; refundableAfterDays?: number | null; additionalInfo?: string | null; isActive?: boolean },
    actorId: string
  ) {
    const computedDuration = getDurationForPlanType(data.type);
    const plan = await db.rentalPlan.create({
      data: {
        name: data.name,
        type: data.type as 'DAILY' | 'WEEKLY' | 'MONTHLY',
        priceInPaise: rupeesToPaise(Number(data.price)),
        securityDepositInPaise: data.securityDeposit != null ? rupeesToPaise(Number(data.securityDeposit)) : 0,
        isSecurityRefundable: data.isSecurityRefundable ?? true,
        refundableAfterDays: data.refundableAfterDays ?? null,
        durationDays: computedDuration,
        description: data.description || null,
        additionalInfo: data.additionalInfo || null,
        // P0-6 (2026-08-07 verification, Section 2 — Admin Marketing):
        // default to INACTIVE (draft) when the flag is omitted. The old
        // `?? true` silently published a plan whenever the admin UI missed
        // the field, making it immediately bookable.
        isActive: typeof data.isActive === 'boolean' ? data.isActive : false,
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
    return {
      ...plan,
      price: paiseToRupees(plan.priceInPaise),
      securityDeposit: paiseToRupees(plan.securityDepositInPaise),
    };
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    const updateData: Record<string, any> = { ...data };
    delete updateData.durationDays;
    if (updateData.price != null) {
      updateData.priceInPaise = rupeesToPaise(Number(updateData.price));
      delete updateData.price;
    }
    if (updateData.securityDeposit != null) {
      updateData.securityDepositInPaise = rupeesToPaise(Number(updateData.securityDeposit));
      delete updateData.securityDeposit;
    }
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
    return {
      ...plan,
      price: paiseToRupees(plan.priceInPaise),
      securityDeposit: paiseToRupees(plan.securityDepositInPaise),
    };
  },

  // P1.9: soft delete — the row (and its audit trail) survives; every read
  // path filters deletedAt: null. Hard deletes are gone from the API.
  async delete(id: string, actorId: string) {
    await db.rentalPlan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    invalidateCache('rental_plans*');
    invalidateCache('rider_plans*');
    createAuditLog({ actorId, action: 'plan.delete', entity: 'plan', entityId: id }).catch(
      () => {}
    );
  },
};
