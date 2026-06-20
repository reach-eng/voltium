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
import { Prisma } from '@prisma/client';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { signRiderUrlsWithProvider } from '@/lib/sign-rider';
import { getFeatureFlags } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';
import { notificationService } from '@/lib/notification-service';
import { logger } from '@/lib/logger';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';

// Field allowlists for mass-assignment protection
const SAFE_RIDER_FIELDS = new Set([
  'fullName', 'email', 'fatherName', 'motherName', 'dob', 'currentAddress',
  'emergencyContact', 'pickupHub', 'teamLeader',
  'planStartDate', 'planEndDate', 'intent', 'referralCode', 'phone',
  'preferredShift', 'referredBy', 'assignedVehicle',
]);

const KYC_FIELDS = new Set([
  'kycStatus', 'profilePhoto', 'riderPhoto', 'signature',
  'aadhaarFront', 'aadhaarBack', 'aadhaarNumber', 'panCard', 'panNumber',
  'bankAccount', 'bankIfsc', 'bankName', 'accountNumber', 'ifscCode', 'rejectionReason',
]);

const WALLET_FIELDS = new Set([
  'walletBalance', 'securityDeposit', 'balanceInPaise', 'depositStatus',
]);

const GUARANTOR_FIELDS = new Set([
  'guarantorStatus', 'guarantorName', 'guarantorRelation', 'guarantorPhone',
  'guarantorDob', 'guarantorAadhaarFront', 'guarantorAadhaarBack', 'guarantorPan',
  'guarantorVideo', 'guarantorSignature', 'guarantorFatherName', 'guarantorMotherName',
  'guarantorAddress', 'guarantorPhoto',
]);

export const adminRiderUseCases = {
  /**
   * List riders with full filters, search, pagination, and shared guarantor detection.
   */
  async list(filters: {
    search?: string;
    state?: string;
    kycStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: string;
  }) {
    const flags = await getFeatureFlags();
    const { search, state, kycStatus, startDate, endDate, page = 1, limit = 20, sortBy = 'createdAt', sortDir = 'desc' } = filters;

    if (kycStatus && !flags.enableKYCVerification) {
      throw new Error('KYC verification is currently disabled');
    }

    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { riderId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    if (state && state !== 'ALL') where.lifecycleStatus = state;
    if (kycStatus) {
      where.kycProfile = { status: kycStatus };
    }
    if (startDate || endDate) {
      where.createdAt = {} as any;
      if (startDate) (where.createdAt as any).gte = new Date(startDate);
      if (endDate) (where.createdAt as any).lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const validSortFields = new Set(['createdAt', 'fullName', 'phone', 'lifecycleStatus', 'kycStatus']);
    const orderByField = validSortFields.has(sortBy) ? sortBy : 'createdAt';
    const orderByDir = sortDir === 'asc' ? 'asc' : 'desc';

    const [riders, total] = await Promise.all([
      db.rider.findMany({
        where,
        select: {
          id: true, riderId: true, fullName: true, phone: true, email: true,
          lifecycleStatus: true, pickupHub: true,
          pickedUpAt: true, registrationDoneAt: true, depositDoneAt: true,
          kycDoneAt: true, planDoneAt: true, teamLeader: true,
          planStartDate: true, planEndDate: true,
          currentPlan: true, currentPlanPrice: true, assignedVehicle: true,
          vehicleId: true, intent: true, referralCode: true,
          fatherName: true, motherName: true, dob: true, currentAddress: true,
          createdAt: true, updatedAt: true,
          pickupPhotoFront: true, pickupPhotoBack: true, pickupPhotoLeft: true,
          pickupPhotoRight: true, pickupPhotoWithVehicle: true,
          deliveryId: true, locationGranted: true, batteryGranted: true,
          contactsGranted: true, callLogsGranted: true, micGranted: true,
          cameraGranted: true, phoneGranted: true,
          emergencyContact: true, preferredShift: true, referredBy: true,
          kycProfile: { select: { id: true, status: true, profilePhoto: true, riderPhoto: true, signature: true, aadhaarFront: true, aadhaarBack: true, aadhaarNumber: true, panCard: true, panNumber: true, bankName: true, accountNumber: true, ifscCode: true, rejectionReason: true, updatedAt: true } },
          wallet: { select: { id: true, balanceInPaise: true, securityDeposit: true, depositStatus: true, paymentStreak: true } },
          guarantor: { select: { id: true, status: true, name: true, relation: true, dob: true, phone: true, aadhaarFront: true, aadhaarBack: true, pan: true, video: true, signature: true, fatherName: true, motherName: true, address: true, photo: true } },
          leases: { where: { status: 'ACTIVE' }, take: 1, select: { createdAt: true, vehicle: { select: { vehicleNumber: true, model: true } } } },
          vehicleReturns: { where: { status: 'SUBMITTED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, photoFront: true, photoBack: true, photoLeft: true, photoRight: true, photoSpeedometer: true, createdAt: true } },
        },
        orderBy: orderByField === 'kycStatus' ? { kycProfile: { status: orderByDir } } : { [orderByField]: orderByDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.rider.count({ where }),
    ]);

    // Shared guarantor detection
    const guarantorPhones = (riders as any[])
      .map((r) => r.guarantor?.phone)
      .filter((phone): phone is string => !!phone && phone.trim() !== '');

    let sharingRiders: any[] = [];
    if (guarantorPhones.length > 0) {
      sharingRiders = (await db.rider.findMany({
        where: { guarantor: { phone: { in: guarantorPhones } } },
        select: { id: true, fullName: true, riderId: true, guarantor: { select: { phone: true } } },
      })) as any[];
    }

    const flat = riders.map((r: any) => {
      const flattened = sharedFlattenRider(r as any);
      const gPhone = (r as any).guarantor?.phone;
      if (gPhone && sharingRiders.length > 0) {
        (flattened as any).sharedGuarantorWith = sharingRiders
          .filter((sr) => sr.id !== r.id && sr.guarantor?.phone === gPhone)
          .map((sr) => (sr.fullName || sr.riderId) as string);
      }
      return flattened;
    });

    const { getStorageProvider } = await import('@/lib/storage');
    const storage = await getStorageProvider();
    const signed = await Promise.all(flat.map(async (r: any) => signRiderUrlsWithProvider(r, storage)));

    return {
      riders: signed,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      flags: { enableKYCVerification: flags.enableKYCVerification, enableGuarantorRequirement: flags.enableGuarantorRequirement },
    };
  },

  /**
   * Create a new rider with associated wallet, KYC, and guarantor records.
   */
  async create(input: { phone: string; fullName?: string }) {
    const { phone, fullName } = input;

    const existing = await db.rider.findUnique({ where: { phone } });
    if (existing) throw new Error('Phone already exists');

    const riderId = `VF-RD-${randomUUID().slice(0, 8).toUpperCase()}`;

    const rider = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.rider.create({
        data: {
          phone,
          fullName: fullName ? sanitizeText(fullName) : null,
          riderId,
          referralCode: `VFR-${randomUUID().slice(0, 6).toUpperCase()}`,
        },
      });

      await tx.wallet.create({ data: { riderId: created.id } });
      await tx.kycProfile.create({ data: { riderId: created.id } });
      await tx.guarantor.create({ data: { riderId: created.id } });

      return tx.rider.findUnique({
        where: { id: created.id },
        include: { kycProfile: true, wallet: true, guarantor: true },
      });
    });

    return sharedFlattenRider(rider as any);
  },

  /**
   * Update a rider with field-level security.
   * Handles safe rider fields, KYC fields, wallet fields (with ledger-backed mutations),
   * guarantor fields, KYC status notifications, and audit logging.
   */
  async update(id: string, data: Record<string, unknown>, context: { actorId: string; actorRole: string }) {
    const { actorId, actorRole } = context;

    const riderData: any = {};
    const kycData: any = {};
    const walletData: any = {};
    const guarantorData: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (KYC_FIELDS.has(key)) {
        if (key === 'kycStatus') kycData.status = value;
        else kycData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      } else if (WALLET_FIELDS.has(key)) {
        if (key === 'walletBalance') walletData.balanceInPaise = Math.round(Number(value) * 100);
        else if (key === 'securityDeposit') walletData.securityDeposit = Math.round(Number(value) * 100);
        else walletData[key] = value;
      } else if (GUARANTOR_FIELDS.has(key)) {
        if (key === 'guarantorStatus') guarantorData.status = value;
        else if (key === 'guarantorName') guarantorData.name = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorRelation') guarantorData.relation = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorPhone') guarantorData.phone = value;
        else if (key === 'guarantorDob') guarantorData.dob = value;
        else if (key === 'guarantorAadhaarFront') guarantorData.aadhaarFront = value;
        else if (key === 'guarantorAadhaarBack') guarantorData.aadhaarBack = value;
        else if (key === 'guarantorPan') guarantorData.pan = value;
        else if (key === 'guarantorVideo') guarantorData.video = value;
        else if (key === 'guarantorSignature') guarantorData.signature = value;
        else if (key === 'guarantorFatherName') guarantorData.fatherName = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorMotherName') guarantorData.motherName = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorAddress') guarantorData.address = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorPhoto') guarantorData.photo = value;
        else guarantorData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      } else if (SAFE_RIDER_FIELDS.has(key)) {
        riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      }
    }

    // Sync lifecycleStatus with KycProfile status
    if (kycData.status === 'APPROVED') {
      riderData.lifecycleStatus = 'KYC_APPROVED';
      riderData.kycDoneAt = new Date();
      guarantorData.status = 'APPROVED';
    }
    if (kycData.status === 'REJECTED' || kycData.status === 'INFO_REQUIRED') {
      riderData.lifecycleStatus = kycData.status === 'REJECTED' ? 'SUSPENDED' : 'KYC_SUBMITTED';
      guarantorData.status = kycData.status === 'REJECTED' ? 'REJECTED' : 'INFO_REQUIRED';
    }

    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      if (Object.keys(riderData).length > 0) {
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
          const wallet = (await tx.wallet.findUnique({ where: { riderId: id }, select: { id: true, balanceInPaise: true } }))
            ?? await tx.wallet.create({ data: { riderId: id }, select: { id: true, balanceInPaise: true } });

          if ('balanceInPaise' in walletData) {
            const targetBalance = walletData.balanceInPaise as number;
            const currentBalance = wallet.balanceInPaise;
            const diff = targetBalance - currentBalance;
            if (diff > 0) {
              await walletLedgerService.credit({ riderId: id, amountInPaise: diff, category: 'ADMIN_ADJUSTMENT', actorId, idempotencyKey: `admin:${id}:balance:${targetBalance}`, note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}` }, tx);
            } else if (diff < 0) {
              await walletLedgerService.debit({ riderId: id, amountInPaise: Math.abs(diff), category: 'ADMIN_ADJUSTMENT', actorId, idempotencyKey: `admin:${id}:balance:${targetBalance}`, note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}`, allowNegative: true }, tx);
            }
            delete walletData.balanceInPaise;
          }

          // Block direct securityDeposit/depositStatus mutations — must use Deposits API
          if ('securityDeposit' in walletData || 'depositStatus' in walletData) {
            throw new Error('Use the Deposits API to modify security deposit or deposit status');
          }

          if (Object.keys(walletData).length > 0) {
            await tx.wallet.update({ where: { id: wallet.id }, data: walletData });
          }
        }
      if (Object.keys(guarantorData).length > 0) {
        await tx.guarantor.upsert({ where: { riderId: id }, update: guarantorData, create: { riderId: id, ...guarantorData } });
      }
      return tx.rider.findUnique({ where: { id }, include: { kycProfile: true, wallet: true, guarantor: true } });
    });

    // Audit log for KYC actions
    if (kycData.status && ['APPROVED', 'REJECTED', 'INFO_REQUIRED'].includes(kycData.status)) {
      createAuditLog({ actorId, actorType: 'ADMIN', action: `kyc_${kycData.status.toLowerCase()}`, entity: 'rider', entityId: id, details: JSON.stringify({ kycStatus: kycData.status, rejectionReason: kycData.rejectionReason || null }) }).catch(() => {});
      notificationService.notifyKycStatusChange(id, kycData.status, kycData.rejectionReason).catch((e) => logger.error('Failed to notify KYC change', e));
    }

    return sharedFlattenRider(result as any);
  },

  /**
   * Get a rider by ID with wallet for admin actions.
   */
  async getRiderWithWallet(id: string) {
    return db.rider.findUnique({
      where: { id },
      include: { wallet: true },
    });
  },

  /**
   * Assign a plan to a rider with override audit logging.
   */
  async assignPlan(riderId: string, planId: string, planName: string, actorId: string, actorRole: string) {
    const plan = await db.rentalPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    await transitionRiderStatus(riderId, 'PLAN_SELECTED');
    const result = await db.rider.update({
      where: { id: riderId },
      data: { currentPlan: plan.name, currentPlanPrice: plan.price, planStartDate: now, planEndDate: endDate, planDoneAt: new Date() },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    await createAuditLog({ actorId, action: 'rider.assign_plan', entity: 'Rider', entityId: riderId, details: { planId, planName, override: true } }).catch(() => {});
    return result;
  },

  /**
   * Complete pickup for a rider — assigns vehicle, activates account.
   */
  async completePickup(riderId: string, data: { vehicleId?: string; hubId?: string; teamLeader?: string }, actorId: string, actorRole: string) {
    const rider = await db.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new Error('Rider not found');

    let assignedTl = data.teamLeader || rider.teamLeader;
    if (!assignedTl || assignedTl === 'Not Assigned') {
      const activeTl = await db.teamLeader.findFirst({ where: { isActive: true } });
      assignedTl = activeTl ? activeTl.name : 'Amit Sharma';
    }

    await transitionRiderStatus(riderId, 'ACTIVE');
    const result = await db.rider.update({
      where: { id: riderId },
      data: { pickedUpAt: new Date(), assignedVehicle: data.vehicleId || 'VF-ASSIGNED-BY-ADMIN', pickupHub: data.hubId || 'Central Hub', teamLeader: assignedTl },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    await createAuditLog({ actorId, action: 'rider.complete_pickup', entity: 'Rider', entityId: riderId, details: { vehicleId: data.vehicleId, hubId: data.hubId, manual: true } }).catch(() => {});
    return result;
  },

  /**
   * End rental for a rider — resets rental state.
   */
  async endRental(riderId: string, actorId: string) {
    const rider = await db.rider.findUnique({ where: { id: riderId }, select: { assignedVehicle: true } });
    const result = await db.rider.update({
      where: { id: riderId },
      data: { assignedVehicle: null, pickedUpAt: null },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    await createAuditLog({ actorId, action: 'rider.end_rental', entity: 'Rider', entityId: riderId, details: { previousVehicle: rider?.assignedVehicle } }).catch(() => {});
    return result;
  },

  /**
   * Get device data for a rider (contacts, call logs, locations).
   */
  async getDeviceData(riderId: string, type: string = 'all') {
    const rider = await db.rider.findUnique({
      where: { id: riderId },
      select: { isAdminLocked: true, lockPassword: true, isUninstallBlocked: true, isLocationMandatory: true, isAppsControlRestricted: true },
    });

    const results: any = { rider };

    if (type === 'CONTACTS' || type === 'all') {
      results.contacts = await db.userContact.findMany({ where: { riderId }, orderBy: { name: 'asc' } });
    }
    if (type === 'CALL_LOGS' || type === 'all') {
      results.callLogs = await db.userCallLog.findMany({ where: { riderId }, orderBy: { timestamp: 'desc' }, take: 50 });
    }
    if (type === 'LOCATION' || type === 'all') {
      results.locations = await db.userLocation.findMany({ where: { riderId }, orderBy: { timestamp: 'desc' }, take: 100 });
    }

    return results;
  },

  async updateSecurityFlags(riderId: string, data: Record<string, unknown>, actorId: string) {
    const updateData = { ...data };
    if (updateData.lockPassword && typeof updateData.lockPassword === 'string') {
      const { hashPassword } = await import('@/lib/password');
      updateData.lockPassword = await hashPassword(updateData.lockPassword);
    }
    await db.rider.update({ where: { id: riderId }, data: updateData });
    await createAuditLog({
      action: 'system.config_change',
      entityId: riderId,
      entity: 'rider',
      actorId,
      details: data,
    });
  },

  /**
   * Delete a rider with cascade clean-up of related records.
   */
  async delete(id: string) {
    await db.$transaction([
      db.notification.deleteMany({ where: { riderId: id } }),
      db.rentalLease.deleteMany({ where: { riderId: id } }),
      db.guarantor.deleteMany({ where: { riderId: id } }),
      db.kycProfile.deleteMany({ where: { riderId: id } }),
      db.wallet.deleteMany({ where: { riderId: id } }),
      db.rider.delete({ where: { id } }),
    ]);
  },

  async listFleet(filters: {
    hubId?: string;
    status?: string;
    search?: string;
    lowBattery?: boolean;
  }) {
    const { hubId, status, search, lowBattery } = filters;
    const where: any = {};

    if (status && status !== 'ALL') {
      if (status === 'active') {
        where.lifecycleStatus = 'ACTIVE';
      } else if (status === 'idle') {
        where.lifecycleStatus = 'PROFILE_SUBMITTED';
      } else if (status === 'offline') {
        where.OR = [
          { lifecycleStatus: 'SUSPENDED' },
          { lifecycleStatus: { notIn: ['ACTIVE', 'PROFILE_SUBMITTED'] } },
        ];
      }
    }

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { riderId: { contains: search } },
      ];
    }

    if (lowBattery) {
      where.batteryLevel = { lt: 20 };
    }

    const riders = (await db.rider.findMany({
      where,
      select: {
        id: true,
        riderId: true,
        fullName: true,
        phone: true,
        lifecycleStatus: true,
        pickupHub: true,
        teamLeader: true,
        currentPlan: true,
        planStartDate: true,
        planEndDate: true,
        lastKnownLat: true,
        lastKnownLng: true,
        lastLocationAt: true,
        batteryLevel: true,
        leases: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: {
            vehicle: {
              select: {
                id: true,
                vehicleNumber: true,
                model: true,
                batteryLevel: true,
                status: true,
                hub: { select: { name: true, city: true } },
              },
            },
          },
        },
      },
      orderBy: { lastLocationAt: 'desc' },
    })) as any[];

    const formatted = riders.map((r) => {
      const lease = r.leases[0];
      return {
        id: r.id,
        riderId: r.riderId,
        fullName: r.fullName,
        phone: r.phone,
        lifecycleStatus: r.lifecycleStatus,
        pickupHub: r.pickupHub,
        teamLeader: r.teamLeader,
        currentPlan: r.currentPlan,
        planStartDate: r.planStartDate,
        planEndDate: r.planEndDate,
        lastKnownLat: r.lastKnownLat,
        lastKnownLng: r.lastKnownLng,
        lastLocationAt: r.lastLocationAt,
        batteryLevel: r.batteryLevel,
        vehicle: lease?.vehicle
          ? {
              id: lease.vehicle.id,
              vehicleNumber: lease.vehicle.vehicleNumber,
              model: lease.vehicle.model,
              batteryLevel: lease.vehicle.batteryLevel,
              status: lease.vehicle.status,
              hubName: lease.vehicle.hub?.name,
              hubCity: lease.vehicle.hub?.city,
            }
          : null,
      };
    });

    let filtered = formatted;
    if (hubId) {
      filtered = filtered.filter((r) => r.pickupHub === hubId || r.vehicle?.hubName === hubId);
    }

    return {
      riders: filtered,
      total: filtered.length,
      lowBatteryCount: filtered.filter((r) => r.batteryLevel < 20).length,
      withLocationCount: filtered.filter((r) => r.lastKnownLat && r.lastKnownLng).length,
    };
  },
};
