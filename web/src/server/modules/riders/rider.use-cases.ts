/**
 * Riders module - Use cases.
 *
 * Orchestrates rider profile management, onboarding state, and lifecycle transitions.
 * All field-level security (field allowlists), relation upserts, and state transitions
 * are handled here — routes stay thin.
 */

import { db } from '@/lib/db';
import { Prisma, RentalStatus } from '@prisma/client';
import { flattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import type { RiderProfileUpdate, RiderState } from './rider.types';
import { riderRepository } from './rider.repository';
import { getCachedRider, invalidateRiderCache } from '@/lib/server-cache';
import { clock } from '@/lib/clock';
import { verifyVerifyReceipt } from '@/lib/verify-receipt';

const GUARANTOR_FIELD_TO_DB: Record<string, string> = {
  guarantorName: 'name',
  guarantorRelation: 'relation',
  guarantorDob: 'dob',
  guarantorPhone: 'phone',
  guarantorAadhaarFront: 'aadhaarFront',
  guarantorAadhaarBack: 'aadhaarBack',
  guarantorPan: 'pan',
  guarantorVideo: 'video',
  guarantorSignature: 'signature',
  guarantorAddress: 'address',
  guarantorPhoto: 'photo',
  guarantorFatherName: 'fatherName',
  guarantorMotherName: 'motherName',
};

// Field allowlists for mass-assignment protection
const SAFE_RIDER_FIELDS = new Set([
  'fullName',
  'email',
  'fatherName',
  'motherName',
  'dob',
  'currentAddress',
  'emergencyContact',
  'intent',
  'locationGranted',
  'batteryGranted',
  'contactsGranted',
  'callLogsGranted',
  'micGranted',
  'cameraGranted',
  'phoneGranted',
  // LANGUAGE-AUDIT (2026-08-16) #6: the rider's chosen language as a
  // BCP-47 language tag (e.g. `en`, `hi`). Sanitized on the way in
  // (validator allows only lowercase letters + optional country code).
  'preferredLocale',
]);

const SAFE_KYC_FIELDS = new Set([
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
  'selfie',
]);

const SAFE_GUARANTOR_FIELDS = new Set([
  'guarantorName',
  'guarantorPhone',
  'guarantorRelation',
  'guarantorDob',
  'guarantorFatherName',
  'guarantorMotherName',
  'guarantorAddress',
  'guarantorAadhaarFront',
  'guarantorAadhaarBack',
  'guarantorPan',
  'guarantorVideo',
  'guarantorSignature',
  'guarantorPhoto',
  'guarantorStatus',
]);

/**
 * DEEP-AUDIT D-P1-5 (2026-08-08): the rent-prompt logic was previously
 * inlined in getDashboard's try/catch. Extracted to a free function so:
 *   1. It runs in parallel with the dashboard's other async work via
 *      Promise.all.
 *   2. It can be unit-tested without spinning up the entire
 *      getDashboard flow.
 *   3. Failures here do not affect the rest of the dashboard response
 *      — the function always resolves to a RentPromptShape (null when
 *      no active lease is due within 24h).
 */
async function computeUpcomingRentPrompt(
  riderDbId: string,
  walletBalanceInPaise: number
): Promise<{
  showPrompt: boolean;
  leaseId: string;
  rentAmountInRupees: number;
  walletBalanceInRupees: number;
  shortfallInRupees: number;
  recommendedTopUpRupees: number;
  dueDate: string;
  dueTimeFormatted: string;
  requiresTopUp: boolean;
} | null> {
  try {
    const activeLease = await db.rentalLease.findFirst({
      where: {
        riderId: riderDbId,
        status: { in: ['BOOKED', 'ACTIVE'] },
      },
      select: {
        id: true,
        finalPriceInPaise: true,
        nextRentDueAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeLease?.nextRentDueAt) return null;

    const now = clock.now();
    const dueAt = new Date(activeLease.nextRentDueAt);
    const msUntilDue = dueAt.getTime() - now.getTime();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    if (msUntilDue > TWENTY_FOUR_HOURS_MS) return null;

    const rentAmountInRupees = Math.ceil(activeLease.finalPriceInPaise / 100);
    const walletBalanceInRupees = Math.floor(walletBalanceInPaise / 100);
    const shortfallInRupees = Math.max(0, rentAmountInRupees - walletBalanceInRupees);
    const recommendedTopUpRupees = shortfallInRupees > 0 ? shortfallInRupees : rentAmountInRupees;
    const isOverdue = msUntilDue < 0;

    const hours = dueAt.getHours();
    const minutes = dueAt.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHour = hours % 12 || 12;
    const formattedTime = `${formattedHour}:${minutes} ${ampm}`;

    return {
      showPrompt: true,
      leaseId: activeLease.id,
      rentAmountInRupees,
      walletBalanceInRupees,
      shortfallInRupees,
      recommendedTopUpRupees,
      dueDate: dueAt.toISOString(),
      dueTimeFormatted: isOverdue ? 'Overdue' : `Due today at ${formattedTime}`,
      requiresTopUp: shortfallInRupees > 0,
    };
  } catch (err) {
    logger.error('[getDashboard] computeUpcomingRentPrompt failed', err);
    return null;
  }
}

export const riderUseCases = {
  /**
   * Gets full rider profile with all relations.
   */
  async getProfile(riderDbId: string) {
    const rider = await getCachedRider(riderDbId, () =>
      db.rider.findUnique({
        where: { id: riderDbId },
        include: {
          kycProfile: true,
          wallet: true,
          guarantor: true,
          vehicleReturns: true,
          vehicle: { select: { vehicleNumber: true, model: true } },
        },
      })
    );
    if (!rider) return null;

    const [unreadNotificationCount, rewardAggregates] = await Promise.all([
      db.notification.count({ where: { riderId: rider.id, isRead: false } }),
      db.reward.aggregate({ where: { riderId: rider.id }, _sum: { points: true } }),
    ]);

    const flatRider = flattenRider(rider);
    let assignedVehicleNumber = flatRider.assignedVehicle;
    let vehicleModel: string | null = null;
    if (rider.vehicle) {
      assignedVehicleNumber = rider.vehicle.vehicleNumber;
      vehicleModel = rider.vehicle.model;
    } else if (flatRider.assignedVehicle) {
      const v = await db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } });
      if (v) {
        assignedVehicleNumber = v.vehicleNumber;
        vehicleModel = v.model;
      }
    }
    flatRider.assignedVehicle = assignedVehicleNumber;

    return {
      ...flatRider,
      vehicleModel,
      referralCode: rider.referralCode,
      unreadNotificationCount,
      totalRewardPoints: rewardAggregates._sum.points || 0,
    };
  },

  /**
   * Get full dashboard data for a rider.
   */
  async rejectPlan(riderDbId: string, adminId: string, reason: string) {
    const rider = await db.rider.findUnique({ where: { id: riderDbId } });
    if (!rider) throw new Error('Rider not found');

    await db.rider.update({
      where: { id: riderDbId },
      data: {
        planDoneAt: null,
        currentPlan: null,
        planRejectionReason: reason,
        lifecycleStatus: 'GUARANTOR_APPROVED',
      },
    });

    invalidateRiderCache(riderDbId);

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'REJECT',
      entity: 'RiderPlan',
      entityId: riderDbId,
      details: { reason },
    });
  },

  async getDashboard(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
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
        lifecycleStatus: true,
        currentPlan: true,
        currentPlanId: true,
        currentPlanPrice: true,
        advanceRentPaid: true,
        // PR-47 (WALLET P1-1): include the current plan's security
        // deposit so the dashboard can render the correct amount
        // without falling back to a hardcoded map. The FK
        // `currentPlanRef` is set in the schema (line 270 of
        // schema.prisma).
        currentPlanRef: { select: { securityDepositInPaise: true } },
        planStartDate: true,
        planEndDate: true,
        planRejectionReason: true,
        referralCode: true,
        pickupHub: true,
        teamLeaderId: true,
        teamLeaderRef: { select: { id: true, name: true, phone: true } },
        emergencyContact: true,
        pickupPhotoFront: true,
        pickupPhotoBack: true,
        pickupPhotoLeft: true,
        pickupPhotoRight: true,
        pickupPhotoWithVehicle: true,
        kycProfile: {
          select: {
            status: true,
            profilePhoto: true,
            riderPhoto: true,
            rejectionReason: true,
            editableFields: true,
          },
        },
        wallet: {
          select: {
            balanceInPaise: true,
            securityDepositInPaise: true,
            depositStatus: true,
            paymentStreak: true,
          },
        },
        guarantor: {
          select: {
            status: true,
            name: true,
            relation: true,
            dob: true,
            phone: true,
            signature: true,
          },
        },
        vehicleReturns: { select: { id: true, status: true } },
        depositRecord: true,
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            vehicleNumber: true,
            model: true,
            batteryLevel: true,
            hub: { select: { id: true, name: true, location: true } },
          },
        },
      },
    });
    if (!rider) return null;

    // DEEP-AUDIT D-P1-5 (2026-08-08): the previous code ran these three
    // queries SEQUENTIALLY (notification.count, then referral-code update,
    // then signRiderUrls + rentalLease.findFirst). The notification count
    // and the rent-prompt lease lookup are independent of each other and
    // of the signRiderUrls work, so they now run in parallel via
    // Promise.all. The referral-code update is fire-and-forget so it
    // doesn't block the response.

    // 1. referralCode: generate if missing. This is a one-time write —
    //    fire-and-forget so a slow update doesn't block the dashboard.
    let referralCode = rider.referralCode;
    if (!referralCode) {
      const namePart = (rider.fullName || 'VOLT').slice(0, 4).toUpperCase();
      const idPart = (rider.riderId || '0000000000').slice(-6);
      referralCode = `${namePart}${idPart}`;
      // No await: best-effort write, do not block the response.
      void db.rider
        .update({
          where: { id: riderDbId },
          data: { referralCode },
        })
        .catch((err: unknown) => {
          logger.error('[getDashboard] Failed to persist generated referral code', err);
        });
    }

    // 2. planDaysRemaining: pure date math, no DB.
    let planDaysRemaining: number | null = null;
    if (
      (rider.lifecycleStatus === 'ACTIVE' ||
        rider.lifecycleStatus === 'PLAN_SELECTED' ||
        rider.lifecycleStatus === 'PICKUP_SCHEDULED') &&
      rider.planEndDate
    ) {
      const diffMs = rider.planEndDate.getTime() - Date.now();
      planDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // 3. Run the three independent async bits in parallel:
    //    - unreadNotifications: 1 indexed count
    //    - signRiderUrls: dynamic import + URL signing
    //    - upcomingRentPrompt: 1 indexed findFirst (lease) + date math
    const [unreadNotifications, signedRider, upcomingRentPrompt] = await Promise.all([
      db.notification
        .count({ where: { riderId: riderDbId, isRead: false } })
        .catch((err: unknown) => {
          logger.error('[getDashboard] unreadNotifications count failed', err);
          return 0;
        }),
      (async () => {
        try {
          const flatRider = flattenRider(rider);
          if (rider.vehicle?.vehicleNumber) {
            flatRider.assignedVehicle = rider.vehicle.vehicleNumber;
          }
          const { signRiderUrls } = await import('@/lib/sign-rider');
          return await signRiderUrls(flatRider);
        } catch (err) {
          logger.error('[getDashboard] signRiderUrls failed', err);
          return { id: rider.id, fullName: rider.fullName, riderId: rider.riderId };
        }
      })(),
      computeUpcomingRentPrompt(riderDbId, rider.wallet?.balanceInPaise ?? 0),
    ]);

    return {
      rider: signedRider,
      referralCode,
      unreadNotifications,
      // PR-VER-2026-08-07 (RIDER_DASHBOARD P0-9): no telemetry/trip-log table
      // exists yet, so report null + dataAvailable:false instead of misleading
      // zeros — the rider app renders a "not yet available" placeholder off
      // dataAvailable. Battery comes from the joined vehicle.
      todayStats: {
        distance: null,
        power: null,
        speed: null,
        dataAvailable: false,
        battery: rider.vehicle?.batteryLevel ?? 0,
      },
      planDaysRemaining,
      upcomingRentPrompt,
    };
  },

  /**
   * Get rewards for a rider.
   */
  async getRewards(riderDbId: string) {
    const rider = await getCachedRider(riderDbId, () =>
      db.rider.findUnique({
        where: { id: riderDbId },
        include: { wallet: { select: { paymentStreak: true } } },
      })
    );
    if (!rider) return null;

    const [rewards, aggregates] = await Promise.all([
      db.reward.findMany({
        where: { riderId: riderDbId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, title: true, points: true, createdAt: true },
      }),
      db.reward.aggregate({ where: { riderId: riderDbId }, _sum: { points: true } }),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthRewards = rewards.filter(
      (r: { createdAt: Date | string }) => new Date(r.createdAt) >= monthStart
    );
    const thisMonthPoints = thisMonthRewards.reduce(
      (sum: number, r: { points: number }) => sum + r.points,
      0
    );

    const totalPoints = aggregates._sum.points || 0;
    const tierBronze = 500;
    const tierSilver = 2000;
    const tierGold = 5000;
    
    let currentTier = 'Bronze';
    let nextTierThreshold = tierSilver;
    if (totalPoints >= tierSilver && totalPoints < tierGold) {
      currentTier = 'Silver';
      nextTierThreshold = tierGold;
    } else if (totalPoints >= tierGold) {
      currentTier = 'Gold';
      nextTierThreshold = tierGold;
    }
    
    const progress = Math.min(1.0, totalPoints / nextTierThreshold);
    const pointsToNext = Math.max(0, nextTierThreshold - totalPoints);

    return {
      rewards,
      totalPoints,
      thisMonthPoints,
      currentStreak: rider.wallet?.paymentStreak ?? 0,
      tier: { currentTier, nextTierThreshold, progress, pointsToNext, tierBronze, tierSilver, tierGold }
    };
  },

  /**
   * Register FCM token for a rider.
   *
   * `riderDbId` must be the internal database id (the `riderDbId` claim
   * from the verified session), not the public `riderId`. Callers (e.g. the
   * /api/rider/register-token route) are responsible for ensuring this.
   */
  async registerFcmToken(riderDbId: string, fcmToken: string) {
    const rider = await getCachedRider(riderDbId, () => db.rider.findUnique({ where: { id: riderDbId } }));
    if (!rider) throw new Error('Rider not found');
    await db.rider.update({ where: { id: riderDbId }, data: { fcmToken } });
    invalidateRiderCache(riderDbId);
  },

  /**
   * List earnings for a rider with pagination and filters.
   */
  async listEarnings(
    riderId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      platform?: string;
      page: number;
      limit: number;
    }
  ) {
    const { startDate, endDate, platform, page, limit } = filters;
    const where: Prisma.RiderEarningWhereInput = { riderId };
    if (startDate || endDate) {
      where.date = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }
    if (platform) where.platform = platform;

    const [earnings, total] = await Promise.all([
      db.riderEarning.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.riderEarning.count({ where }),
    ]);

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklySummary = await db.riderEarning.aggregate({
      where: { riderId, date: { gte: startOfWeek } },
      _sum: { amountInPaise: true, trips: true, distance: true, hoursOnline: true },
      _count: { id: true },
    });

    return {
      earnings,
      weeklySummary: {
        // PR-RUPEES-2026-08-08: totalEarnings is exposed to the rider
        // app in rupees (matches the per-earning `amount` field on
        // each item). Internally the DB stores paise.
        totalEarnings: (weeklySummary._sum?.amountInPaise ?? 0) / 100,
        totalTrips: weeklySummary._sum?.trips ?? 0,
        totalDistance: weeklySummary._sum?.distance ?? 0,
        totalHoursOnline: weeklySummary._sum?.hoursOnline ?? 0,
        daysWorked: weeklySummary._count?.id ?? 0,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Create an earning record for a rider.
   */
  async createEarning(
    riderId: string,
    data: {
      date: string;
      platform?: string;
      amount: number;
      trips: number;
      distance?: number;
      hoursOnline?: number;
      notes?: string;
    }
  ) {
    return db.riderEarning.create({
      data: {
        riderId,
        date: new Date(data.date),
        platform: data.platform || null,
        amountInPaise: data.amount,
        trips: data.trips,
        distance: data.distance || null,
        hoursOnline: data.hoursOnline || null,
        notes: data.notes || null,
      },
    });
  },

  /**
   * Update rider profile with field-level security.
   * Handles safe rider fields, KYC fields, guarantor fields, and vehicle returns.
   */
  async updateProfile(riderDbId: string, input: Record<string, unknown>) {
    const existing = await getCachedRider(riderDbId, () =>
      db.rider.findUnique({ where: { id: riderDbId } })
    );
    if (!existing) throw new Error('Rider not found');

    const riderData: Record<string, unknown> = {};
    const kycData: Record<string, unknown> = {};
    const guarantorData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;

      if (SAFE_RIDER_FIELDS.has(key)) {
        riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      } else if (SAFE_KYC_FIELDS.has(key)) {
        // PR-ONBOARDING-2026-08-11 (audit 2.10): KYC string values
        // (aadhaarNumber, panNumber, name, address, etc.) are not
        // sanitized. PII columns are stored encrypted via the
        // repository, but the surrounding strings (fatherName, address,
        // bankName) go to Postgres in cleartext. Run them through
        // sanitizeText so a stray HTML tag or control char from a
        // compromised client cannot end up in the audit log or admin UI.
        const sanitized =
          typeof value === 'string' ? sanitizeText(value) : value;
        if (key === 'bankAccount') kycData['accountNumber'] = sanitized;
        else if (key === 'bankIfsc') kycData['ifscCode'] = sanitized;
        else if (key === 'selfie') kycData['profilePhoto'] = sanitized;
        else kycData[key] = sanitized;
      } else if (SAFE_GUARANTOR_FIELDS.has(key)) {
        // PR-ONBOARDING-2026-08-11 (audit 2.10): same — guarantor
        // name, address, parents' names are PII on a non-rider record.
        const dbKey =
          GUARANTOR_FIELD_TO_DB[key] ??
          (key.startsWith('guarantor')
            ? key.charAt(9).toLowerCase() + key.slice(10)
            : key);
        guarantorData[dbKey] =
          typeof value === 'string' ? sanitizeText(value) : value;
      }
    }

    // Update core rider fields
    if (Object.keys(riderData).length > 0) {
      if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
        const name = riderData.fullName as string;
        const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
        riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
      }
      await db.rider.update({ where: { id: riderDbId }, data: riderData });
    }

    // Handle vehicle returns
    if (input.returnPending === true && (input.returnPhotos as string[] | undefined)?.length) {
      const photos = input.returnPhotos as string[];
      let vehicleId = existing.vehicleId || null;
      if (!vehicleId && existing.assignedVehicle) {
        const vehicle = await db.vehicle.findFirst({
          where: {
            OR: [
              { vehicleId: existing.assignedVehicle },
              { vehicleNumber: existing.assignedVehicle },
            ],
          },
          select: { id: true },
        });
        vehicleId = vehicle?.id || null;
      }
      if (!vehicleId) throw new Error('No vehicle assigned to this rider');

      await db.vehicleReturn.create({
        data: {
          riderId: riderDbId,
          vehicleId,
          status: 'SUBMITTED',
          photoLeft: photos[0],
          photoRight: photos[1],
          photoFront: photos[2],
          photoSpeedometer: photos[3],
          latitude: input.latitude as number | undefined,
          longitude: input.longitude as number | undefined,
          reason: (input.returnReason as string) || 'End of rental',
        },
      });

      await transitionRiderStatus(riderDbId, 'RETURN_PENDING');
    }

    // Update KYC profile
    if (Object.keys(kycData).length > 0) {
      await db.kycProfile.upsert({
        where: { riderId: riderDbId },
        create: { riderId: riderDbId, ...(kycData as any), status: 'SUBMITTED' },
        update: { ...(kycData as any), status: 'SUBMITTED' },
      });
    }

    // Update Guarantor
    if (Object.keys(guarantorData).length > 0) {
      if (guarantorData.phone) {
        const cleanGuarantorPhone = String(guarantorData.phone).replace(/\D/g, '');
        const cleanRiderPhone = existing.phone ? String(existing.phone).replace(/\D/g, '') : '';
        if (cleanGuarantorPhone.length > 0 && cleanGuarantorPhone === cleanRiderPhone) {
          throw new Error('Guarantor phone cannot be the same as rider phone');
        }

        const receipt = input.guarantorPhoneReceipt as string | undefined;
        if (receipt) {
          const receiptCheck = verifyVerifyReceipt(receipt, cleanGuarantorPhone);
          if (!receiptCheck.valid) {
            throw new Error(`Guarantor phone verification receipt is invalid: ${receiptCheck.reason}`);
          }
        }
      }

      if (!guarantorData.relation) guarantorData.relation = 'Other';
      await db.guarantor.upsert({
        where: { riderId: riderDbId },
        create: {
          riderId: riderDbId,
          name: (guarantorData.name as string) || 'N/A',
          relation: (guarantorData.relation as string) || 'Other',
          phone: (guarantorData.phone as string) || '0000000000',
          ...(guarantorData as any),
          status: 'SUBMITTED',
        },
        update: { ...(guarantorData as any), status: 'SUBMITTED' },
      });
    }

    // Advance lifecycle based on submissions
    const currentRider = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
    
    if (currentRider) {
      // 1. If Guarantor data is present, move from PROFILE_SUBMITTED to GUARANTOR_SUBMITTED (Guarantor Form completed)
      if (Object.keys(guarantorData).length > 0) {
        const freshStatus = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
        if (freshStatus?.lifecycleStatus === 'PROFILE_SUBMITTED') {
          await transitionRiderStatus(riderDbId, 'GUARANTOR_SUBMITTED');
        }
      }

      // 2. If KYC data is present, move from DEPOSIT_APPROVED to KYC_SUBMITTED (KYC Form completed)
      if (Object.keys(kycData).length > 0) {
        if (currentRider.lifecycleStatus === 'NEW') {
          await transitionRiderStatus(riderDbId, 'PHONE_VERIFIED');
        }
        
        const freshStatus = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
        if (freshStatus?.lifecycleStatus === 'PHONE_VERIFIED' || freshStatus?.lifecycleStatus === 'NEW') {
          await transitionRiderStatus(riderDbId, 'PROFILE_SUBMITTED');
        }
        
        if (freshStatus?.lifecycleStatus === 'DEPOSIT_APPROVED') {
          await transitionRiderStatus(riderDbId, 'KYC_SUBMITTED');
        }
      }
    }

    // Return updated profile
    invalidateRiderCache(riderDbId);
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });
    if (!rider) return null;
    const flatRider = flattenRider(rider);
    let assignedVehicleNumber = flatRider.assignedVehicle;
    if (flatRider.assignedVehicle) {
      const v = await db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } });
      if (v) assignedVehicleNumber = v.vehicleNumber;
    }
    flatRider.assignedVehicle = assignedVehicleNumber;
    return flatRider;
  },

  async getState(riderDbId: string): Promise<RiderState | null> {
    const rider = await riderRepository.getFullState(riderDbId);
    if (!rider) return null;

    const ACTIVE_LEASE_STATUSES: RentalStatus[] = [
      'BOOKED',
      'PICKUP_SCHEDULED',
      'ACTIVE',
      'OVERDUE',
      'RETURN_PENDING',
    ];
    const activeLease = (rider.leases || []).find((lease) =>
      ACTIVE_LEASE_STATUSES.includes(lease.status)
    );

    return {
      riderId: rider.riderId,
      phone: rider.phone,
      fullName: rider.fullName || '',
      lifecycleStatus: rider.lifecycleStatus as RiderState['lifecycleStatus'],
      isOnboarded: ['ACTIVE', 'RETURN_PENDING', 'CLOSED'].includes(rider.lifecycleStatus),
      kycStatus: rider.kycProfile?.status || 'PENDING',
      guarantorStatus: rider.guarantor?.status || 'PENDING',
      depositStatus: rider.wallet?.depositStatus || 'NOT_SUBMITTED',
      rentalStatus:
        activeLease?.status || (rider.lifecycleStatus === 'ACTIVE' ? 'ACTIVE' : 'NO_RENTAL'),
      activePlan: rider.currentPlan
        ? {
            id: rider.currentPlan,
            startDate: rider.planStartDate,
            endDate: rider.planEndDate,
          }
        : null,
      assignedVehicle:
        rider.vehicleId || rider.assignedVehicle
          ? { id: rider.vehicleId, vehicleId: rider.assignedVehicle }
          : null,
      // PR-RUPEES-2026-08-08: `walletBalance` on the rider object is
      // exposed in rupees to clients (matches the field name and
      // convention used by the dashboard route and the Flutter
      // wallet provider). Internally the DB stores paise.
      walletBalance: (rider.wallet?.balanceInPaise || 0) / 100,
    };
  },
};
