import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { paiseToRupees, rupeesToPaise } from '@/lib/flatten-rider';
import { createAuditLog } from '@/lib/audit-log';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';

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
    if (
      !['DEPOSIT_APPROVED', 'PLAN_SELECTED', 'PICKUP_SCHEDULED', 'ACTIVE'].includes(
        rider.lifecycleStatus
      )
    )
      throw new Error('DEPOSIT_NOT_APPROVED');
    if (!rider.wallet || rider.wallet.balanceInPaise < plan.price)
      throw new Error('INSUFFICIENT_BALANCE');
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + plan.durationDays);
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findUnique({ where: { riderId: riderDbId } });
      if (!wallet || wallet.balanceInPaise < plan.price) throw new Error('INSUFFICIENT_BALANCE');
      const txn = await tx.transaction.create({
        data: {
          riderId: riderDbId,
          type: 'DEBIT',
          amount: plan.price,
          purpose: 'RENT_PAYMENT',
          status: 'APPROVED',
          description: `Plan subscription: ${plan.name}`,
        },
      });
      await walletLedgerService.debit(
        {
          riderId: riderDbId,
          amountInPaise: plan.price,
          category: 'RENT_PAYMENT',
          txnId: txn.id,
          idempotencyKey: `plan:${riderDbId}:${plan.id}:${txn.id}`,
          note: `Plan: ${plan.name}`,
        },
        tx
      );
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
    data: { name: string; type: string; price: number; durationDays: number; description?: string },
    actorId: string
  ) {
    const plan = await db.rentalPlan.create({
      data: {
        name: data.name,
        type: data.type as 'DAILY' | 'WEEKLY' | 'MONTHLY',
        price: rupeesToPaise(Number(data.price)),
        durationDays: data.durationDays,
        description: data.description || null,
        isActive: true,
      },
    });
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
    if (data.durationDays != null) data.durationDays = Number(data.durationDays);
    const plan = await db.rentalPlan.update({ where: { id }, data });
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
    createAuditLog({ actorId, action: 'plan.delete', entity: 'plan', entityId: id }).catch(
      () => {}
    );
  },
};
