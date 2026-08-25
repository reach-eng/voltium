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
import { Prisma, RiderLifecycleStatus, KycStatus } from '@prisma/client';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { signRiderUrlsWithProvider } from '@/lib/sign-rider';
import { getFeatureFlags } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';
import { logAccountSuspension } from '@/lib/security-events';
import { notificationService } from '@/lib/notification-service';
import { logger } from '@/lib/logger';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { transitionRiderStatus, validateTransition } from '@/server/modules/riders/rider-lifecycle.service';
import { encryptPii } from '@/lib/pii-crypto';
import { getDurationForPlanType } from '@/server/modules/plans/plan.use-cases';
import { getCachedRider, getCachedRiderByPhone, invalidateRiderCache, invalidateRiderPhoneCache } from '@/lib/server-cache';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';

// Field allowlists for mass-assignment protection
const SAFE_RIDER_FIELDS = new Set([
  'fullName',
  'email',
  'fatherName',
  'motherName',
  'dob',
  'currentAddress',
  'emergencyContact',
  'pickupHub',
  'teamLeaderId',
  'planStartDate',
  'planEndDate',
  'intent',
  'referralCode',
  'phone',
  'preferredShift',
  'referredBy',
  'assignedVehicle',
  'vehicleId',
  'currentPlan',
  'currentPlanId',
  'pickedUpAt',
  'lifecycleStatus',
  'registrationDoneAt',
  'depositDoneAt',
  'kycDoneAt',
  'planDoneAt',
]);

const KYC_FIELDS = new Set([
  'kycStatus',
  'profilePhoto',
  'riderPhoto',
  'signature',
  'aadhaarFront',
  'aadhaarBack',
  'aadhaarNumber',
  'panCard',
  'panNumber',
  'bankAccount',
  'bankIfsc',
  'bankName',
  'accountNumber',
  'ifscCode',
  'rejectionReason',
  'editableFields',
]);

const WALLET_FIELDS = new Set([
  'securityDeposit',
  'balanceInPaise',
  'depositStatus',
]);

const GUARANTOR_FIELDS = new Set([
  'guarantorStatus',
  'guarantorName',
  'guarantorRelation',
  'guarantorPhone',
  'guarantorDob',
  'guarantorAadhaarFront',
  'guarantorAadhaarBack',
  'guarantorPan',
  'guarantorVideo',
  'guarantorSignature',
  'guarantorFatherName',
  'guarantorMotherName',
  'guarantorAddress',
  'guarantorPhoto',
]);

export const adminRiderUseCases = {
  /**
   * List riders with full filters, search, pagination, and shared guarantor detection.
   */
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
    const flags = await getFeatureFlags();
    const {
      search,
      state,
      kycStatus,
      hubId,
      startDate,
      endDate,
      cursor,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortDir = 'desc',
      deleted = false,
    } = filters;

    if (kycStatus && !flags.enableKYCVerification) {
      throw new Error('KYC verification is currently disabled');
    }

    const where: Prisma.RiderWhereInput = {};
    if (search) {
      const trimmed = search.trim();
      const isPhoneLike = /^\+?[0-9]{5,15}$/.test(trimmed);
      if (isPhoneLike) {
        where.phone = { startsWith: trimmed };
      } else {
        where.OR = [
          { fullName: { contains: trimmed, mode: 'insensitive' } },
          { riderId: { contains: trimmed, mode: 'insensitive' } },
          { phone: { contains: trimmed } },
        ];
      }
    }
    // PR-7 (2026-08-06 fix-plan; 1st audit P0-1): the data-deletion queue
    // needs to list soft-deleted riders. Explicit `deletedAt` filter overrides
    // the middleware's default `deletedAt: null` (see lib/db.ts).
    if (deleted) {
      where.deletedAt = { not: null };
    }
    if (hubId) {
      where.pickupHub = hubId;
    }
    if (state && state !== 'ALL') where.lifecycleStatus = state as RiderLifecycleStatus;
    if (kycStatus) {
      where.kycProfile = { status: kycStatus as KycStatus };
    }
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
      };
    }

    const validSortFields = new Set([
      'createdAt',
      'fullName',
      'phone',
      'lifecycleStatus',
      'kycStatus',
    ]);
    const orderByField = validSortFields.has(sortBy) ? sortBy : 'createdAt';
    const orderByDir = sortDir === 'asc' ? 'asc' : 'desc';

    const [riders, total] = await Promise.all([
      db.rider.findMany({
        where,
        select: {
          id: true,
          riderId: true,
          fullName: true,
          phone: true,
          email: true,
          fatherName: true,
          motherName: true,
          dob: true,
          currentAddress: true,
          emergencyContact: true,
          lifecycleStatus: true,
          pickupHub: true,
          pickedUpAt: true,
          registrationDoneAt: true,
          depositDoneAt: true,
          kycDoneAt: true,
          planDoneAt: true,
          teamLeaderId: true,
          advanceRentPaid: true,
          locationGranted: true,
          batteryGranted: true,
          contactsGranted: true,
          callLogsGranted: true,
          micGranted: true,
          cameraGranted: true,
          phoneGranted: true,
          teamLeaderRef: {
            select: {
              name: true,
              phone: true,
            },
          },
          planStartDate: true,
          planEndDate: true,
          currentPlan: true,
          currentPlanPrice: true,
          assignedVehicle: true,
          vehicleId: true,
          intent: true,
          referralCode: true,
          createdAt: true,
          updatedAt: true,
          // PR-7 (1st audit P0-1): the data-deletion queue shows
          // daysRemaining from deletedAt; the purge worker (7-day window)
          // needs it in the payload too.
          deletedAt: true,
          // PR-2026-08-16: lets the queue distinguish "purged" from
          // "pending 7-day window" (deletedAt set, purgedAt null).
          purgedAt: true,
          kycProfile: {
            select: {
              id: true,
              status: true,
              profilePhoto: true,
              riderPhoto: true,
              signature: true,
              aadhaarFront: true,
              aadhaarBack: true,
              aadhaarNumber: true,
              panCard: true,
              panNumber: true,
              bankName: true,
              accountNumber: true,
              ifscCode: true,
              rejectionReason: true,
              updatedAt: true,
            },
          },
          wallet: {
            select: {
              id: true,
              balanceInPaise: true,
              securityDepositInPaise: true,
              depositStatus: true,
              paymentStreak: true,
            },
          },
          guarantor: {
            select: {
              id: true,
              status: true,
              name: true,
              relation: true,
              dob: true,
              phone: true,
              aadhaarFront: true,
              aadhaarBack: true,
              pan: true,
              video: true,
              signature: true,
              fatherName: true,
              motherName: true,
              address: true,
              photo: true,
            },
          },
          leases: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: { createdAt: true, vehicle: { select: { vehicleNumber: true, model: true } } },
          },
          vehicleReturns: {
            where: { status: 'SUBMITTED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              photoFront: true,
              photoBack: true,
              photoLeft: true,
              photoRight: true,
              photoSpeedometer: true,
              createdAt: true,
            },
          },
        },
        orderBy:
          orderByField === 'kycStatus'
            ? { kycProfile: { status: orderByDir } }
            : { [orderByField]: orderByDir },
        ...(cursor
          ? { cursor: { id: cursor }, skip: 1 }
          : { skip: (page - 1) * limit }),
        take: limit,
      }),
      db.rider.count({ where }),
    ]);

    // Shared guarantor detection
    const guarantorPhones = riders
      .map((r) => r.guarantor?.phone)
      .filter((phone): phone is string => !!phone && phone.trim() !== '');

    let sharingRiders: Array<{ id: string; fullName: string | null; riderId: string; guarantor: { phone: string | null } | null }> = [];
    if (guarantorPhones.length > 0) {
      sharingRiders = await db.rider.findMany({
        where: { guarantor: { phone: { in: guarantorPhones } } },
        select: { id: true, fullName: true, riderId: true, guarantor: { select: { phone: true } } },
      });
    }

    const flat = riders.map((r) => {
      const flattened = sharedFlattenRider(r);
      const gPhone = r.guarantor?.phone;
      if (gPhone && sharingRiders.length > 0) {
        (flattened as { sharedGuarantorWith?: string[] }).sharedGuarantorWith = sharingRiders
          .filter((sr) => sr.id !== r.id && sr.guarantor?.phone === gPhone)
          .map((sr) => (sr.fullName || sr.riderId) as string);
      }
      return flattened;
    });

    const { getStorageProvider } = await import('@/lib/storage');
    const storage = await getStorageProvider();
    const urlCache = new Map<string, string>();
    const signed = await Promise.all(flat.map((r) => signRiderUrlsWithProvider(r, storage, urlCache)));

    const lastRider = signed[signed.length - 1];
    return {
      riders: signed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: lastRider?.id ?? null,
      },
      flags: {
        enableKYCVerification: flags.enableKYCVerification,
        enableGuarantorRequirement: flags.enableGuarantorRequirement,
      },
    };
  },

  /**
   * Create a new rider with associated wallet, KYC, and guarantor records.
   */
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

    // The phone-existence check above may have cached "not found" for this
    // phone; clear it so the next create attempt with the same phone sees
    // the freshly-inserted rider and fails the unique constraint cleanly.
    invalidateRiderPhoneCache(phone);

    if (!rider) throw new Error('Rider created but could not be reloaded');
    return sharedFlattenRider(rider);
  },

  /**
   * Update a rider with field-level security.
   * Handles safe rider fields, KYC fields, wallet fields (with ledger-backed mutations),
   * guarantor fields, KYC status notifications, and audit logging.
   */
  async update(
    id: string,
    data: Record<string, unknown>,
    context: { actorId: string; actorRole: string }
  ) {
    const { actorId, actorRole } = context;

    const existing = await getCachedRider(id, () => db.rider.findUnique({ where: { id } }));
    if (!existing) throw new Error('Rider not found');

    const riderData: any = {};
    const kycData: any = {};
    const walletData: any = {};
    const guarantorData: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'walletBalance') {
        throw new Error('Direct walletBalance mutations are blocked — use Wallet Adjust API');
      }

      if (KYC_FIELDS.has(key)) {
        if (key === 'kycStatus') {
          kycData.status = value;
        } else if (['aadhaarNumber', 'panNumber', 'bankAccount', 'accountNumber', 'ifscCode', 'bankIfsc'].includes(key)) {
          kycData[key] = typeof value === 'string' && value.length > 0 ? encryptPii(sanitizeText(value)) : value;
        } else {
          kycData[key] = typeof value === 'string' ? sanitizeText(value) : value;
        }
      } else if (WALLET_FIELDS.has(key)) {
        if (key === 'securityDeposit')
          walletData.securityDeposit = Math.round(Number(value) * 100);
        else walletData[key] = value;
      } else if (GUARANTOR_FIELDS.has(key)) {
        if (key === 'guarantorStatus') guarantorData.status = value;
        else if (key === 'guarantorName')
          guarantorData.name = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorRelation')
          guarantorData.relation = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorPhone') guarantorData.phone = value;
        else if (key === 'guarantorDob') guarantorData.dob = value;
        else if (key === 'guarantorAadhaarFront') guarantorData.aadhaarFront = value;
        else if (key === 'guarantorAadhaarBack') guarantorData.aadhaarBack = value;
        else if (key === 'guarantorPan' || key === 'pan')
          guarantorData.pan = typeof value === 'string' && value.length > 0 ? encryptPii(sanitizeText(value)) : value;
        else if (key === 'guarantorVideo') guarantorData.video = value;
        else if (key === 'guarantorSignature') guarantorData.signature = value;
        else if (key === 'guarantorFatherName')
          guarantorData.fatherName = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorMotherName')
          guarantorData.motherName = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorAddress')
          guarantorData.address = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorPhoto') guarantorData.photo = value;
        else guarantorData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      } else if (SAFE_RIDER_FIELDS.has(key)) {
        riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      }
    }

    // Validate manual lifecycleStatus transition if requested directly by admin
    if (riderData.lifecycleStatus && riderData.lifecycleStatus !== existing.lifecycleStatus) {
      validateTransition(existing.lifecycleStatus as RiderLifecycleStatus, riderData.lifecycleStatus as RiderLifecycleStatus);
    }

    // Sync lifecycleStatus with KycProfile status.
    //
    // PR-ONBOARDING-FLOW-2026-08-13: do NOT downgrade a rider who has
    // already progressed past the KYC rank. The admin can legitimately
    // approve KYC for a rider who is already PICKUP_SCHEDULED or
    // ACTIVE (e.g., the KYC was pending when the rider was fast-tracked
    // through the flow, or the admin is fixing a stale KYC record after
    // the fact). Setting lifecycleStatus = 'KYC_APPROVED' in that
    // case would yank the rider back to the KYC-approved rank and
    // strand them on the wrong screen — the mobile app would have
    // stale PICKUP_SCHEDULED data and the hang-tight poll would never
    // see the new (downgraded) state because the rider is already
    // past it on the server. The rider would be stuck on hang-tight
    // even though the admin intended to *progress* them.
    //
    // The correct behaviour: only set lifecycleStatus if the rider's
    // current rank is <= the KYC rank (4). For a rider already at
    // rank 5+ (GUARANTOR_SUBMITTED or beyond), the KYC approval is
    // recorded (kycDoneAt + guarantorData.status) but the lifecycle
    // stays where it is.
    if (kycData.status === 'APPROVED') {
      const currentRank = lifecycleRankOf(existing.lifecycleStatus);
      if (currentRank <= 4) {
        riderData.lifecycleStatus = 'KYC_APPROVED';
      }
      riderData.kycDoneAt = new Date();
      // PR-ONBOARDING-FLOW-2026-08-13: only auto-approve the guarantor
      // if it was already in SUBMITTED state. Previously, KYC approval
      // unconditionally set guarantorData.status = 'APPROVED', which
      // silently auto-approved a rider's guarantor on KYC review alone.
      // KYC review and guarantor review are independent gates — the
      // admin should explicitly approve the guarantor, not piggyback
      // on KYC approval. If the guarantor is still in PENDING/DRAFT
      // (rider hasn't submitted it yet), leave it alone.
      const existingGuarantor = await db.guarantor.findUnique({ where: { riderId: id } });
      if (existingGuarantor?.status === 'SUBMITTED') {
        guarantorData.status = 'APPROVED';
      }
    }
    if (kycData.status === 'REJECTED' || kycData.status === 'INFO_REQUIRED') {
      // Same guard for rejections: do not downgrade a rider who is
      // already past KYC in the flow. A late rejection should not
      // yank them back to KYC_SUBMITTED.
      const wasSuspended = kycData.status === 'REJECTED';
      const currentRank = lifecycleRankOf(existing.lifecycleStatus);
      if (currentRank <= 4) {
        riderData.lifecycleStatus = wasSuspended ? 'SUSPENDED' : 'KYC_SUBMITTED';
      }
      guarantorData.status = wasSuspended ? 'REJECTED' : 'INFO_REQUIRED';

      // PR-99: fire the security-event logger when a rider is suspended
      // (KYC rejection). Fire-and-forget so the update tx is not slowed
      // by audit-log writes. This makes "rider.suspended" a queryable
      // event in the audit log (SOC2 requirement).
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
        const wallet =
          (await tx.wallet.findUnique({
            where: { riderId: id },
            select: { id: true, balanceInPaise: true },
          })) ??
          (await tx.wallet.create({
            data: { riderId: id },
            select: { id: true, balanceInPaise: true },
          }));

        if ('balanceInPaise' in walletData) {
          const targetBalance = walletData.balanceInPaise as number;
          const currentBalance = wallet.balanceInPaise;
          const diff = targetBalance - currentBalance;
          if (diff > 0) {
            await walletLedgerService.credit(
              {
                riderId: id,
                amountInPaise: diff,
                category: 'ADMIN_ADJUSTMENT',
                actorId,
                idempotencyKey: `admin:${id}:balance:${targetBalance}`,
                note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}`,
              },
              tx
            );
          } else if (diff < 0) {
            await walletLedgerService.debit(
              {
                riderId: id,
                amountInPaise: Math.abs(diff),
                category: 'ADMIN_ADJUSTMENT',
                actorId,
                idempotencyKey: `admin:${id}:balance:${targetBalance}`,
                note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}`,
                allowNegative: true,
              },
              tx
            );
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

    // Audit log for KYC actions
    if (kycData.status && ['APPROVED', 'REJECTED', 'INFO_REQUIRED'].includes(kycData.status)) {
      createAuditLog({
        actorId,
        actorType: 'ADMIN',
        action: `kyc_${kycData.status.toLowerCase()}`,
        entity: 'rider',
        entityId: id,
        details: JSON.stringify({
          kycStatus: kycData.status,
          rejectionReason: kycData.rejectionReason || null,
        }),
      }).catch(() => {});
      notificationService
        .notifyKycStatusChange(id, kycData.status, kycData.rejectionReason)
        .catch((e) => logger.error('Failed to notify KYC change', e));
    }

    if (!result) throw new Error('Rider not found after KYC update');
    return sharedFlattenRider(result);
  },

  /**
   * Get a rider by ID with wallet for admin actions.
   */
  async getRiderWithWallet(id: string) {
    return getCachedRider(id, () =>
      db.rider.findUnique({
        where: { id },
        include: { wallet: true },
      })
    );
  },

  /**
   * Assign a plan to a rider with override audit logging.
   */
  async assignPlan(
    riderId: string,
    planId: string,
    actorId: string,
    actorRole: string
  ) {
    // P0-4 (2026-08-05 legal/device audit): the old signature took a
    // caller-supplied `planName` that the route passed `planId` into — the
    // audit log recorded the plan ID as its name. The plan is fetched below
    // anyway, so derive the name from the DB row (single source of truth).
    // P1.9: a soft-deleted plan must not be assignable.
    const plan = await db.rentalPlan.findUnique({ where: { id: planId, deletedAt: null } });
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const endDate = new Date(now);
    // P2.1: durationDays is strictly derived from type — the DB column is a
    // sanity-check only, never the billing source of truth.
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

  /**
   * Complete pickup for a rider — assigns vehicle, activates account.
   */
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

  /**
   * End rental for a rider — resets rental state.
   */
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

  /**
   * Get device data for a rider (contacts, call logs, locations).
   */
  async getDeviceData(riderId: string, type: string = 'all') {
    // P0-5 (2026-08-05 legal/device audit): the old select read
    // `lockPassword` — a field that does not exist on the Rider model (the
    // column is `lockPasswordHash`). Prisma silently returned undefined and
    // the TS type lied. The hash must never reach the admin UI anyway, so
    // drop the field entirely rather than selecting the hash.
    const rider = await db.rider.findUnique({
      where: { id: riderId },
      select: {
        isAdminLocked: true,
        isUninstallBlocked: true,
        isLocationMandatory: true,
        isAppsControlRestricted: true,
      },
    });

    const results: {
      rider: typeof rider;
      contacts?: Awaited<ReturnType<typeof db.userContact.findMany>>;
      callLogs?: Awaited<ReturnType<typeof db.userCallLog.findMany>>;
      locations?: Awaited<ReturnType<typeof db.userLocation.findMany>>;
    } = { rider };

    if (type === 'CONTACTS' || type === 'all') {
      results.contacts = await db.userContact.findMany({
        where: { riderId },
        orderBy: { name: 'asc' },
      });
    }
    if (type === 'CALL_LOGS' || type === 'all') {
      results.callLogs = await db.userCallLog.findMany({
        where: { riderId },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    }
    if (type === 'LOCATION' || type === 'all') {
      results.locations = await db.userLocation.findMany({
        where: { riderId },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
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
    invalidateRiderCache(riderId);
    await createAuditLog({
      action: 'system.config_change',
      entityId: riderId,
      entity: 'rider',
      actorId,
      details: (({ lockPassword, ...safe }) => safe)(data),
    });
  },

  /**
   * Delete a rider with cascade clean-up of related records.
   */
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
    const { hubId, status, search, lowBattery } = filters;
    const where: Prisma.RiderWhereInput = {};

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

    const riders = await db.rider.findMany({
      where,
      select: {
        id: true,
        riderId: true,
        fullName: true,
        phone: true,
        lifecycleStatus: true,
        createdAt: true,
        pickupHub: true,
        teamLeaderId: true,
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
    });

    const formatted = riders.map((r) => {
      const lease = r.leases[0];
      return {
        id: r.id,
        riderId: r.riderId,
        fullName: r.fullName,
        phone: r.phone,
        createdAt: r.createdAt,
        lifecycleStatus: r.lifecycleStatus,
        pickupHub: r.pickupHub,
        teamLeaderId: r.teamLeaderId,
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
