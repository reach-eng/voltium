import { db } from '@/lib/db';
import { Prisma, RiderLifecycleStatus } from '@prisma/client';
import { paiseToRupees, rupeesToPaise, SKIP_GUARANTOR_FALLBACK_PAISE, SKIP_GUARANTOR_SETTING_KEY } from '@/lib/flatten-rider';
import { createAuditLog } from '@/lib/audit-log';
import { invalidateCache, getCachedResponse, cacheResponse } from '@/lib/cache';
import { invalidateRiderCache } from '@/lib/server-cache';

/**
 * Skip-guarantor extra deposit in paise (F-03 surcharge).
 *
 * P1: was hardcoded to 100000 in three places while the admin panel edits
 * `SystemSetting skipGuarantorExtraDeposit` — admin changes had no effect on
 * enforcement. Single source of truth, cached 60s like referralBonus.
 */
export async function getSkipGuarantorExtraDepositPaise(): Promise<number> {
  // Defensive typeof-guards: unit-test doubles of @/lib/cache or @/lib/db
  // may not implement these (fallback = default surcharge, fail-closed to
  // charging the standard extra amount rather than zero).
  try {
    if (typeof getCachedResponse === 'function') {
      const cached = getCachedResponse<string>(SKIP_GUARANTOR_SETTING_KEY);
      if (cached) {
        const v = parseInt(cached, 10);
        if (Number.isFinite(v) && v > 0) return v;
      }
    }
    if (typeof db?.systemSetting?.findFirst === 'function') {
      const setting = await db.systemSetting.findFirst({
        where: { key: 'skipGuarantorExtraDeposit' },
      });
      const paise = parseInt(setting?.value || String(SKIP_GUARANTOR_FALLBACK_PAISE), 10);
      const sane = Number.isFinite(paise) && paise > 0 ? paise : SKIP_GUARANTOR_FALLBACK_PAISE;
      if (typeof cacheResponse === 'function') {
        cacheResponse(SKIP_GUARANTOR_SETTING_KEY, String(sane), 60);
      }
      return sane;
    }
  } catch {
    // DB/cache unavailable — fall through to the default surcharge.
  }
  return SKIP_GUARANTOR_FALLBACK_PAISE;
}

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

export const ALLOWED_STATES_FOR_PLAN_SELECTION = [
  'NEW',
  'NO_RENTAL',
  'PHONE_VERIFIED',
  'PROFILE_SUBMITTED',
  'KYC_SUBMITTED',
  'KYC_APPROVED',
  'GUARANTOR_SUBMITTED',
  'GUARANTOR_APPROVED',
  'PLAN_SELECTED',
  'DEPOSIT_PENDING',
  'DEPOSIT_APPROVED',
  'PICKUP_SCHEDULED',
  'ACTIVE',
  'RETURN_PENDING',
  'RETURN_APPROVED',
] as const;

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

  async subscribeToPlan(riderDbId: string, planId: string, advanceRentPaid?: boolean, securityDeposit?: number, opts?: { guarantorSkipped?: boolean }) {
    // F-03: If rider skipped guarantor, they require extra security deposit.
    // P1: the flag is server-owned (set by POST /api/rider/guarantor/skip or
    // the subscribe-time `guarantorSkipped` declaration — both set-true-only;
    // only a real guarantor submission clears it). The amount comes from the
    // admin-managed `skipGuarantorExtraDeposit` setting, not a hardcoded
    // constant.
    let rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { wallet: true },
    });
    if (!rider) throw new Error('Rider not found');
    if (opts?.guarantorSkipped === true && !rider.requiresHigherDeposit) {
      rider = await db.rider.update({
        where: { id: riderDbId },
        data: { requiresHigherDeposit: true },
        include: { wallet: true },
      });
    }
    const plan = await db.rentalPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');
    if (!plan.isActive) throw new Error('Plan is not active');

    const extraDepositInPaise = rider.requiresHigherDeposit
      ? await getSkipGuarantorExtraDepositPaise()
      : 0;
    const minDepositInPaise = plan.securityDepositInPaise + extraDepositInPaise;

    if (securityDeposit !== undefined && securityDeposit !== null) {
      const depositInPaise = rupeesToPaise(Number(securityDeposit));
      if (depositInPaise < minDepositInPaise) {
        throw new Error('INSUFFICIENT_SECURITY_DEPOSIT');
      }
    }
    
    if (
      // PR-ONBOARDING-2026-08-11 (audit 2.13): NO_RENTAL and NEW are valid
      // entry points (brand-new riders, or riders who closed their prior
      // rental and are re-subscribing). Without these, a brand-new rider
      // cannot reach PLAN_SELECTED via the normal path; the only way was
      // the dev-only `autoProvisionTestRider` flow. CLOSED and SUSPENDED
      // remain excluded — closed accounts cannot re-subscribe and
      // suspended riders need admin intervention first.
      !ALLOWED_STATES_FOR_PLAN_SELECTION.includes(rider.lifecycleStatus as any)
    ) {
      throw new Error('INVALID_STATE_FOR_PLAN_SELECTION');
    }

    // P3.14 (2026-08-05 rentals/vehicles/hubs audit): allowing KYC_* states
    // here is the RE-SUBSCRIPTION path — a rider who already completed KYC on
    // a prior plan can switch plans mid-flow. The use-case overwrites
    // currentPlan/planEndDate for the new plan, which is the intended
    // behavior; leases created under the old plan keep their own pricing.
    // A future `changePlan` use-case could formalize this, but the explicit
    // re-subscription semantics are documented here rather than silently
    // restricting the rider flow.

    const durationDays = getDurationForPlanType(plan.type);

    // F-11: In-transaction status guard & optimistic concurrency control (CAS).
    // Re-verify the rider's latest lifecycleStatus inside the transaction to avoid
    // race conditions (e.g. concurrent admin suspension, account closure, or parallel subscription).
    const txResult = await db.$transaction(async (tx) => {
      let currentLifecycleStatus = rider.lifecycleStatus;
      if (typeof (tx.rider as any)?.findUnique === 'function') {
        const freshRider = await tx.rider.findUnique({
          where: { id: riderDbId },
          select: { lifecycleStatus: true },
        });
        if (!freshRider) {
          throw new Error('Rider not found');
        }
        currentLifecycleStatus = freshRider.lifecycleStatus;
      }

      if (!ALLOWED_STATES_FOR_PLAN_SELECTION.includes(currentLifecycleStatus as any)) {
        throw new Error('INVALID_STATE_FOR_PLAN_SELECTION');
      }

      // F-05: Plan window starts at activation, not selection.
      // For riders currently onboarding (not yet ACTIVE), plan dates remain null
      // until vehicle pickup activation. If rider is already ACTIVE (e.g. re-subscribing /
      // switching plan mid-rental), the new plan window starts immediately.
      const isTxActive = currentLifecycleStatus === 'ACTIVE';
      let planStartDate: Date | null = null;
      let planEndDate: Date | null = null;

      if (isTxActive) {
        planStartDate = new Date();
        planEndDate = new Date(planStartDate);
        planEndDate.setDate(planEndDate.getDate() + durationDays);
      }

      const targetStatus: RiderLifecycleStatus = isTxActive ? 'ACTIVE' : 'PLAN_SELECTED';

      const updateData = {
        lifecycleStatus: targetStatus,
        currentPlan: plan.name,
        currentPlanId: plan.id,
        currentPlanPrice: plan.priceInPaise,
        ...(advanceRentPaid !== undefined ? { advanceRentPaid: Boolean(advanceRentPaid) } : {}),
        planStartDate,
        planEndDate,
        planDoneAt: new Date(),
      };

      if (typeof (tx.rider as any)?.updateMany === 'function') {
        const updateRes = await tx.rider.updateMany({
          where: {
            id: riderDbId,
            lifecycleStatus: currentLifecycleStatus as RiderLifecycleStatus,
          },
          data: updateData,
        });

        if (updateRes.count === 0) {
          throw new Error('RIDER_LIFECYCLE_CONFLICT');
        }
      } else {
        await tx.rider.update({
          where: { id: riderDbId },
          data: updateData,
        });
      }

      return { planStartDate, planEndDate };
    });

    // PR-ONBOARDING-2026-08-11 (audit 2.15): invalidate the rider cache so
    // the dashboard / status views pick up the new plan immediately. Without
    // this, cached `currentPlan` survives until TTL expiry and a rider
    // re-subscribing sees their old plan in the UI until the next refresh.
    invalidateRiderCache(riderDbId);
    const effectiveSecurityDepositInPaise = plan.securityDepositInPaise + extraDepositInPaise;
    return {
      planId: plan.id,
      planName: plan.name,
      startDate: txResult.planStartDate ? txResult.planStartDate.toISOString() : null,
      endDate: txResult.planEndDate ? txResult.planEndDate.toISOString() : null,
      durationDays,
      price: paiseToRupees(plan.priceInPaise),
      securityDeposit: paiseToRupees(effectiveSecurityDepositInPaise),
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
