import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { NotFoundError } from "@/lib/api-error";

/**
 * Assign a plan to a rider with override audit logging.
 */
export async function assignPlan(
  riderId: string,
  planId: string,
  planName: string,
  actorId: string,
  actorRole: string
) {
  const plan = await db.rentalPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new NotFoundError('Plan not found');

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + plan.durationDays);

  await transitionRiderStatus(riderId, 'PLAN_SELECTED');
  const result = await db.rider.update({
    where: { id: riderId },
    data: {
      currentPlan: plan.name,
      currentPlanPrice: plan.price,
      planStartDate: now,
      planEndDate: endDate,
      planDoneAt: new Date(),
    },
    include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
  });

  await createAuditLog({
    actorId,
    action: 'rider.assign_plan',
    entity: 'Rider',
    entityId: riderId,
    details: { planId, planName, override: true },
  }).catch(() => {});
  return result;
}
