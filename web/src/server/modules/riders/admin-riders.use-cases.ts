/**
 * Admin Riders module - Use cases.
 *
 * Orchestrates admin rider management: list with full filters, create with relations,
 * update with field-level security and wallet adjustments, delete with cascade.
 *
 * All wallet mutations go through wallet-service (ledger-backed).
 */

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { RiderLifecycleStatus } from '@prisma/client';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { createAuditLog } from '@/lib/audit-log';
import { logAccountSuspension } from '@/lib/security-events';
import { notificationService } from '@/lib/notification-service';
import { logger } from '@/lib/logger';
import { transitionRiderStatus, validateTransition } from '@/server/modules/riders/rider-lifecycle.service';
import { getDurationForPlanType } from '@/server/modules/plans/plan.use-cases';
import { getCachedRider, getCachedRiderByPhone, invalidateRiderCache, invalidateRiderPhoneCache } from '@/lib/server-cache';

// ── Sub-module Imports & Re-exports ─────────────────────────────────────────

export {
  WALLET_FIELDS,
  applyAdminBalanceAdjustment,
} from './admin-riders.wallet';

export {
  KYC_FIELDS,
  GUARANTOR_FIELDS,
  processKycData,
  processGuarantorData,
} from './admin-riders.kyc-patch';

export {
  SAFE_RIDER_FIELDS,
  processSafeRiderData,
  syncLifecycleWithKycStatus,
  suspendRider,
  reactivateRider,
} from './admin-riders.lifecycle';

export {
  listFleetRiders,
  getRiderDeviceData,
  updateRiderSecurityFlags,
} from './admin-riders.fleet';

export {
  listRiders,
} from './admin-riders.query';

import {
  WALLET_FIELDS,
  applyAdminBalanceAdjustment,
} from './admin-riders.wallet';

import {
  processKycData,
  processGuarantorData,
} from './admin-riders.kyc-patch';

import {
  processSafeRiderData,
  syncLifecycleWithKycStatus,
} from './admin-riders.lifecycle';

import {
  listFleetRiders,
  getRiderDeviceData,
  updateRiderSecurityFlags,
} from './admin-riders.fleet';

import {
  listRiders,
} from './admin-riders.query';

export const adminRiderUseCases = {
  async list(filters: {
    search?: string;
    state?: string;
    kycStatus?: string;
    hubId?: string;
    startDate?: string;
    endDate?: string;
    cursor?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: string;
    deleted?: boolean;
  }) {
    return listRiders(filters);
  },

  async create(input: { phone: string; fullName?: string }) {
    const { phone, fullName } = input;

    const existing = await getCachedRiderByPhone(phone, () =>
      db.rider.findUnique({ where: { phone } })
    );
    if (existing) throw new Error('Phone already exists');

    const riderId = `VF-RD-${randomUUID().slice(0, 8).toUpperCase()}`;

    const rider = await db.$transaction(async (tx) => {
      let created = await tx.rider.create({
        data: {
          phone,
          fullName: fullName ? sanitizeText(fullName) : null,
          riderId,
          referralCode: `VFR-${randomUUID().slice(0, 6).toUpperCase()}`,
        },
      });

      if (fullName) {
        const prefix = fullName.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
        const newRiderId = `VEM${prefix}${String(created.serialNumber).padStart(3, '0')}`;
        created = await tx.rider.update({
          where: { id: created.id },
          data: { riderId: newRiderId },
        });
      }

      await tx.wallet.create({ data: { riderId: created.id } });
      await tx.kycProfile.create({ data: { riderId: created.id } });
      await tx.guarantor.create({ data: { riderId: created.id } });

      return tx.rider.findUnique({
        where: { id: created.id },
        include: { kycProfile: true, wallet: true, guarantor: true },
      });
    });

    invalidateRiderPhoneCache(phone);

    if (!rider) throw new Error('Rider created but could not be reloaded');
    return sharedFlattenRider(rider);
  },

  async update(
    id: string,
    data: Record<string, unknown>,
    context: { actorId: string; actorRole: string }
  ) {
    const { actorId, actorRole } = context;

    const balanceAdjustmentToken =
      typeof data.balanceAdjustmentToken === 'string' ? (data.balanceAdjustmentToken as string) : null;
    delete data.balanceAdjustmentToken;

    const existing = await getCachedRider(id, () => db.rider.findUnique({ where: { id } }));
    if (!existing) throw new Error('Rider not found');

    if ('walletBalance' in data) {
      throw new Error('Direct walletBalance mutations are blocked — use Wallet Adjust API');
    }

    const riderData = processSafeRiderData(data);
    const kycData = processKycData(data);
    const guarantorData = processGuarantorData(data);
    const walletData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (WALLET_FIELDS.has(key)) {
        if (key === 'securityDeposit') walletData.securityDeposit = Math.round(Number(value) * 100);
        else walletData[key] = value;
      }
    }

    if (riderData.lifecycleStatus && riderData.lifecycleStatus !== existing.lifecycleStatus) {
      validateTransition(existing.lifecycleStatus as RiderLifecycleStatus, riderData.lifecycleStatus as RiderLifecycleStatus);
    }

    if (kycData.status) {
      const existingGuarantor = await db.guarantor.findUnique({ where: { riderId: id } });
      const { wasSuspended } = syncLifecycleWithKycStatus(
        existing.lifecycleStatus as RiderLifecycleStatus,
        kycData.status as string,
        riderData,
        guarantorData,
        existingGuarantor?.status
      );

      if (wasSuspended) {
        void logAccountSuspension({
          riderId: id,
          adminId: actorId,
          reason: 'kyc_rejected',
        });
      }
    }

    const result = await db.$transaction(async (tx) => {
      if (Object.keys(riderData).length > 0) {
        if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
          const name = riderData.fullName as string;
          const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
          riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
        }
        await tx.rider.update({ where: { id }, data: riderData });
      }
      if (Object.keys(kycData).length > 0) {
        await tx.kycProfile.upsert({
          where: { riderId: id },
          update: kycData,
          create: { riderId: id, ...kycData },
        });
      }
      if (Object.keys(walletData).length > 0) {
        if ('balanceInPaise' in walletData) {
          const targetBalance = walletData.balanceInPaise as number;
          await applyAdminBalanceAdjustment(tx, id, targetBalance, actorId, balanceAdjustmentToken);
          delete walletData.balanceInPaise;
        }

        if ('securityDeposit' in walletData || 'depositStatus' in walletData) {
          throw new Error('Use the Deposits API to modify security deposit or deposit status');
        }

        if (Object.keys(walletData).length > 0) {
          const wallet = await tx.wallet.findUnique({ where: { riderId: id } });
          if (wallet) {
            await tx.wallet.update({ where: { id: wallet.id }, data: walletData });
          }
        }
      }
      if (Object.keys(guarantorData).length > 0) {
        await tx.guarantor.upsert({
          where: { riderId: id },
          update: guarantorData,
          create: { riderId: id, ...guarantorData },
        });
      }
      return tx.rider.findUnique({
        where: { id },
        include: { kycProfile: true, wallet: true, guarantor: true },
      });
    });

    invalidateRiderCache(id);

    if (kycData.status && ['APPROVED', 'REJECTED', 'INFO_REQUIRED'].includes(kycData.status as string)) {
      createAuditLog({
        actorId,
        actorType: 'ADMIN',
        action: `kyc_${(kycData.status as string).toLowerCase()}`,
        entity: 'rider',
        entityId: id,
        details: JSON.stringify({
          kycStatus: kycData.status,
          rejectionReason: kycData.rejectionReason || null,
        }),
      }).catch(() => {});
      notificationService
        .notifyKycStatusChange(id, kycData.status as string, kycData.rejectionReason as string | undefined)
        .catch((e) => logger.error('Failed to notify KYC change', e));
    }

    if (!result) throw new Error('Rider not found after KYC update');
    return sharedFlattenRider(result);
  },

  async getRiderWithWallet(id: string) {
    return getCachedRider(id, () =>
      db.rider.findUnique({
        where: { id },
        include: { wallet: true },
      })
    );
  },

  async assignPlan(
    riderId: string,
    planId: string,
    actorId: string,
    actorRole: string
  ) {
    const plan = await db.rentalPlan.findUnique({ where: { id: planId, deletedAt: null } });
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + getDurationForPlanType(plan.type));

    await transitionRiderStatus(riderId, 'PLAN_SELECTED');
    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        currentPlan: plan.name,
        currentPlanPrice: plan.priceInPaise,
        planStartDate: now,
        planEndDate: endDate,
        planDoneAt: new Date(),
      },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    invalidateRiderCache(riderId);

    await createAuditLog({
      actorId,
      action: 'rider.assign_plan',
      entity: 'Rider',
      entityId: riderId,
      details: { planId, planName: plan.name, override: true },
    }).catch(() => {});
    return result;
  },

  async completePickup(
    riderId: string,
    data: { vehicleId?: string; hubId?: string; teamLeaderId?: string },
    actorId: string,
    actorRole: string
  ) {
    const rider = await getCachedRider(riderId, () => db.rider.findUnique({ where: { id: riderId } }));
    if (!rider) throw new Error('Rider not found');

    let assignedTl = data.teamLeaderId || rider.teamLeaderId;
    if (!assignedTl || assignedTl === 'Not Assigned') {
      const activeTl = await db.teamLeader.findFirst({ where: { isActive: true } });
      assignedTl = activeTl ? activeTl.id : null;
    }

    let assignedVehicleString = 'VF-ASSIGNED-BY-ADMIN';
    if (data.vehicleId) {
      const v = await db.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (v) assignedVehicleString = v.vehicleNumber;
    }

    await transitionRiderStatus(riderId, 'ACTIVE');
    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        pickedUpAt: new Date(),
        assignedVehicle: assignedVehicleString,
        pickupHub: data.hubId || 'Central Hub',
        teamLeaderId: assignedTl,
      },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    invalidateRiderCache(riderId);

    await createAuditLog({
      actorId,
      action: 'rider.complete_pickup',
      entity: 'Rider',
      entityId: riderId,
      details: { vehicleId: data.vehicleId, hubId: data.hubId, manual: true },
    }).catch(() => {});
    return result;
  },

  async endRental(riderId: string, actorId: string) {
    const rider = await getCachedRider(riderId, () =>
      db.rider.findUnique({
        where: { id: riderId },
        select: { assignedVehicle: true },
      })
    );
    const result = await db.rider.update({
      where: { id: riderId },
      data: { assignedVehicle: null, pickedUpAt: null },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    invalidateRiderCache(riderId);

    await createAuditLog({
      actorId,
      action: 'rider.end_rental',
      entity: 'Rider',
      entityId: riderId,
      details: { previousVehicle: rider?.assignedVehicle },
    }).catch(() => {});
    return result;
  },

  async getDeviceData(riderId: string, type: string = 'all') {
    return getRiderDeviceData(riderId, type);
  },

  async updateSecurityFlags(riderId: string, data: Record<string, unknown>, actorId: string) {
    return updateRiderSecurityFlags(riderId, data, actorId);
  },

  async delete(id: string, actorId?: string) {
    await db.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { riderId: id } });
      await tx.rentalLease.deleteMany({ where: { riderId: id } });
      await tx.guarantor.deleteMany({ where: { riderId: id } });
      await tx.kycProfile.deleteMany({ where: { riderId: id } });
      await tx.wallet.deleteMany({ where: { riderId: id } });
      await tx.rider.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: 'rider.delete',
          entity: 'rider',
          entityId: id,
          actorId: actorId ?? 'system',
          actorType: actorId ? 'ADMIN' : 'SYSTEM',
          details: JSON.stringify({ riderId: id }),
        },
      });
    });
    invalidateRiderCache(id);
  },

  async listFleet(filters: {
    hubId?: string;
    status?: string;
    search?: string;
    lowBattery?: boolean;
  }) {
    return listFleetRiders(filters);
  },
};
