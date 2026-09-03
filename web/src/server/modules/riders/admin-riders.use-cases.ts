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
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { getDurationForPlanType } from '@/server/modules/plans/plan.use-cases';
import { ensureActiveRentalLease } from '@/server/modules/rentals/rental.use-cases';
import { getCachedRider, getCachedRiderByPhone, invalidateRiderCache, invalidateRiderPhoneCache, invalidateVehicleCache } from '@/lib/server-cache';
import { invalidateCache } from '@/lib/cache';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { validateKycTransition, type KycStatus as KycMachineStatus } from '@/server/modules/kyc/kyc-state-machine';
import { fleetUseCases } from '@/server/modules/riders/admin-rider-fleet.use-cases';

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
        if (key === 'kycStatus') kycData.status = value;
        else kycData[key] = typeof value === 'string' ? sanitizeText(value) : value;
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
        else if (key === 'guarantorPan') guarantorData.pan = value;
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
        // P1: the old code upserted any KYC status (DRAFT→APPROVED without
        // SUBMITTED) with no state-machine check. Admins follow the same
        // machine — fix stale records via SUBMITTED first (kyc review
        // endpoints), not by jumping states here.
        if (kycData.status) {
          const currentKyc = await tx.kycProfile.findUnique({
            where: { riderId: id },
            select: { status: true },
          });
          // PENDING is the DB default for "never submitted" — normalize to
          // DRAFT for transition purposes (the machine starts at DRAFT).
          const norm = (s: string): KycMachineStatus =>
            (s === 'PENDING' ? 'DRAFT' : s) as KycMachineStatus;
          validateKycTransition(
            norm(currentKyc?.status || 'DRAFT'),
            norm(kycData.status as string)
          );
        }
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
          // P1: cap the balance-set legs like the wallet-adjust API. The
          // bulk-update path has no co-approve/daily-cap machinery, so any
          // leg above the per-call admin debit cap must go through POST
          // /api/admin/riders/[id]/wallet-adjust (proof + co-approval +
          // daily aggregate cap) instead of silently applying here.
          const { env } = await import('@/lib/env');
          const maxLegPaise = env.MAX_ADMIN_DEBIT_INR * 100;
          if (Math.abs(diff) > maxLegPaise) {
            throw new Error(
              `Balance change of ₹${(Math.abs(diff) / 100).toFixed(2)} exceeds the per-call admin limit of ₹${env.MAX_ADMIN_DEBIT_INR} — use the Wallet Adjust API`
            );
          }
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

    const rider = await getCachedRider(riderId, () => db.rider.findUnique({ where: { id: riderId } }));
    const isActive = rider?.lifecycleStatus === 'ACTIVE';

    // F-05: Plan window starts at activation, not selection.
    // Pre-active riders have plan dates set to null until vehicle pickup.
    const durationDays = getDurationForPlanType(plan.type);
    let planStartDate: Date | null = null;
    let planEndDate: Date | null = null;

    if (isActive) {
      planStartDate = new Date();
      planEndDate = new Date(planStartDate.getTime() + durationDays * 86400000);
    } else {
      await transitionRiderStatus(riderId, 'PLAN_SELECTED');
    }

    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        currentPlan: plan.name,
        currentPlanId: plan.id,
        currentPlanPrice: plan.priceInPaise,
        planStartDate,
        planEndDate,
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
    const rider = await getCachedRider(riderId, () =>
      db.rider.findUnique({
        where: { id: riderId },
        include: { currentPlanRef: true },
      })
    );
    if (!rider) throw new Error('Rider not found');

    let assignedTl = data.teamLeaderId || rider.teamLeaderId;
    if (!assignedTl || assignedTl === 'Not Assigned') {
      const activeTl = await db.teamLeader.findFirst({ where: { isActive: true } });
      assignedTl = activeTl ? activeTl.id : null;
    }

    let assignedVehicleString = 'VF-ASSIGNED-BY-ADMIN';
    if (data.vehicleId) {
      const v = await db.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!v) throw new Error('Vehicle not found');
      // P1: guard the claim — the old code flipped ANY vehicle (including
      // MAINTENANCE/RETIRED) to ACTIVE_RENTAL with .catch(()=>{}), so a
      // concurrent admin pickup could clobber fleet state. Only AVAILABLE or
      // RESERVED vehicles can be claimed; the updateMany count check makes
      // the claim atomic against concurrent pickups.
      if (v.status !== 'AVAILABLE' && v.status !== 'RESERVED') {
        throw new Error(`Vehicle ${v.vehicleNumber} is not available for pickup (status: ${v.status})`);
      }
      assignedVehicleString = v.vehicleNumber;
      await ensureActiveRentalLease(db, rider, data.vehicleId);
      const claimed = await db.vehicle.updateMany({
        where: { id: data.vehicleId, status: { in: ['AVAILABLE', 'RESERVED'] } },
        data: { status: 'ACTIVE_RENTAL', assignedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error(`Vehicle ${v.vehicleNumber} was claimed by another pickup; please retry`);
      }
    }

    // F-05: Plan window starts at activation (vehicle pickup), not at selection.
    // Derive durationDays strictly from plan type (DAILY=1, WEEKLY=7, MONTHLY=30)
    let plan = rider.currentPlanRef;
    if (!plan && rider.currentPlanId && db.rentalPlan?.findUnique) {
      plan = await db.rentalPlan.findUnique({ where: { id: rider.currentPlanId } });
    }
    if (!plan && rider.currentPlan && db.rentalPlan?.findFirst) {
      plan = await db.rentalPlan.findFirst({ where: { name: rider.currentPlan, deletedAt: null } });
    }
    const durationDays = plan ? getDurationForPlanType(plan.type) : 7;
    const now = new Date();
    const planEndDate = new Date(now.getTime() + durationDays * 86400000);

    await transitionRiderStatus(riderId, 'ACTIVE');
    // P1: validate an explicit hubId instead of persisting garbage; fall back
    // to 'Central Hub' only when no hub was given (legacy behavior). Accepts
    // a hub id or a hub name (legacy callers pass names).
    let pickupHub = 'Central Hub';
    if (data.hubId) {
      const hub =
        (await db.hub.findUnique({ where: { id: data.hubId }, select: { id: true, name: true } })) ??
        (await db.hub.findFirst({ where: { name: data.hubId }, select: { id: true, name: true } }));
      if (!hub) throw new Error('Pickup hub not found');
      pickupHub = hub.name || data.hubId;
    }
    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        pickedUpAt: now,
        assignedVehicle: assignedVehicleString,
        pickupHub,
        teamLeaderId: assignedTl,
        planStartDate: now,
        planEndDate: planEndDate,
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
   * End rental for a rider — resets rental state and transitions to CLOSED.
   */
  async endRental(riderId: string, actorId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        riderId: true,
        assignedVehicle: true,
        vehicleId: true,
        lifecycleStatus: true,
      },
    });
    if (!rider) throw new Error(`Rider not found: ${riderId}`);

    const previousStatus = rider.lifecycleStatus;
    const assignedVehicleString = rider.assignedVehicle;
    let vehicleDbId = rider.vehicleId;

    if (!vehicleDbId && assignedVehicleString) {
      const vehicle = await db.vehicle.findFirst({
        where: {
          OR: [
            { vehicleId: assignedVehicleString },
            { vehicleNumber: assignedVehicleString },
          ],
        },
        select: { id: true },
      });
      vehicleDbId = vehicle?.id ?? null;
    }

    // 1. Transition lifecycle status to CLOSED (supports RETURN_PENDING, ACTIVE, SUSPENDED; no-op if already CLOSED)
    // P1: fleet/lease/return closures run FIRST and throw on failure, so a
    // failed vehicle or lease write can never leave a CLOSED rider with an
    // ACTIVE_RENTAL vehicle / ACTIVE lease behind (the old .catch(()=>{})
    // steps hid exactly that fleet leak). The CLOSED transition runs last;
    // a mid-flow failure leaves the rider non-CLOSED and retry-safe.
    // 2. Mark assigned vehicle as AVAILABLE
    if (vehicleDbId && db.vehicle?.updateMany) {
      await db.vehicle.updateMany({
        where: { id: vehicleDbId },
        data: { status: 'AVAILABLE', assignedAt: null, currentRiderId: null },
      }).catch((err) => {
        logger.error('[endRental] Vehicle update to AVAILABLE failed (blocking)', { err, vehicleDbId });
        throw new Error('Failed to release vehicle to AVAILABLE; endRental aborted before closing rider');
      });
    }

    // 3. Close any active/return_pending rental leases
    if (db.rentalLease?.updateMany) {
      await db.rentalLease.updateMany({
        where: {
          riderId,
          status: { in: ['ACTIVE', 'RETURN_PENDING', 'PICKUP_SCHEDULED', 'OVERDUE'] },
        },
        data: {
          status: 'CLOSED',
          endTime: new Date().toISOString().slice(11, 16),
        },
      }).catch((err) => {
        logger.error('[endRental] Rental lease closure failed (blocking)', { err, riderId });
        throw new Error('Failed to close rental leases; endRental aborted before closing rider');
      });
    }

    // 4. Close any open vehicle return records for this rider
    if (db.vehicleReturn?.updateMany) {
      await db.vehicleReturn.updateMany({
        where: {
          riderId,
          status: { in: ['SUBMITTED', 'INSPECTION_PENDING'] },
        },
        data: {
          status: 'CLOSED',
          inspectedBy: actorId,
          inspectedAt: new Date(),
        },
      }).catch((err) => {
        logger.error('[endRental] Vehicle return closure failed (blocking)', { err, riderId });
        throw new Error('Failed to close vehicle returns; endRental aborted before closing rider');
      });
    }

    if (rider.lifecycleStatus !== 'CLOSED') {
      await transitionRiderStatus(riderId, 'CLOSED');
    }

    // 5. Clear assigned vehicle and rental plan window on rider
    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        assignedVehicle: null,
        vehicleId: null,
        pickedUpAt: null,
        planStartDate: null,
        planEndDate: null,
      },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    // 6. Invalidate caches
    invalidateRiderCache(riderId);
    if (vehicleDbId) {
      invalidateVehicleCache(vehicleDbId);
    }
    invalidateCache('vehicles_list:*');
    invalidateCache('admin:vehicles:*');
    invalidateCache('admin:rentals:*');

    // 7. Audit log
    await createAuditLog({
      actorId,
      action: 'rider.end_rental',
      entity: 'Rider',
      entityId: riderId,
      details: {
        previousVehicle: assignedVehicleString,
        previousStatus,
        newStatus: 'CLOSED',
      },
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
      // P1: bound like the sibling call-log/location queries — device
      // contact books can be large (PII dump vector).
      results.contacts = await db.userContact.findMany({
        where: { riderId },
        orderBy: { name: 'asc' },
        take: 200,
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
   * Delete a rider — SOFT-DELETE ONLY (P0 fix 2026-09-03).
   *
   * The previous implementation hard-deleted children first
   * (notification/rentalLease/guarantor/kycProfile/wallet via deleteMany)
   * then soft-deleted the rider. That permanently wiped KYC/guarantor/lease
   * history the soft-delete design was meant to preserve, destroyed Wallet /
   * DepositRecord lineage that the schema marks onDelete: Restrict, and
   * violated the append-only transaction/ledger triggers. Mid-transaction
   * Restrict failures also left partial wipes.
   *
   * Now: refuse when financial rows exist (wallet, transactions, ledger,
   * deposits), otherwise soft-delete the rider only (the db.ts extension
   * converts rider.delete into a deletedAt update). Child rows are preserved
   * for audit/forensics and stay hidden via the deletedAt filter. Use the
   * GDPR data-deletion-purge job for lawful full purges, never this path.
   */
  async delete(id: string, actorId?: string) {
    const financial = await db.$transaction(async (tx) => {
      const [wallet, txn, ledger, deposit] = await Promise.all([
        tx.wallet.findFirst({ where: { riderId: id }, select: { id: true } }),
        tx.transaction.findFirst({ where: { riderId: id }, select: { id: true } }),
        tx.walletLedger.findFirst({ where: { riderId: id }, select: { id: true } }),
        tx.depositRecord.findFirst({ where: { riderId: id }, select: { id: true } }),
      ]);
      return { wallet, txn, ledger, deposit };
    });
    if (financial.wallet || financial.txn || financial.ledger || financial.deposit) {
      throw new Error(
        'Refusing to delete rider with financial records (wallet/transaction/ledger/deposit). Use lifecycle CLOSE + GDPR purge job instead.'
      );
    }
    await db.$transaction(async (tx) => {
      await tx.rider.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: 'rider.delete',
          entity: 'rider',
          entityId: id,
          actorId: actorId ?? 'system',
          actorType: actorId ? 'ADMIN' : 'SYSTEM',
          details: JSON.stringify({ riderId: id, mode: 'soft-delete' }),
        },
      });
    });
    invalidateRiderCache(id);
  },

  // P1: fleet listing lives in admin-rider-fleet.use-cases.ts (god-module
  // decomposition, step 1). Delegation keeps existing callers working.
  async listFleet(filters: {
    hubId?: string;
    status?: string;
    search?: string;
    lowBattery?: boolean;
    page?: number;
    limit?: number;
  }) {
    return fleetUseCases.listFleet(filters);
  },
};
