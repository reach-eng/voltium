/**
 * Riders module - Use cases.
 *
 * Orchestrates rider profile management, onboarding state, and lifecycle transitions.
 * All field-level security (field allowlists), relation upserts, and state transitions
 * are handled here — routes stay thin.
 */

import { db } from '@/lib/db';
import { Prisma, RentalStatus } from '@prisma/client';
import { flattenRider, stripRiderSecretsForRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { RiderValidationError } from '@/server/modules/riders/rider-lifecycle.service';
import type { RiderProfileUpdate, RiderState } from './rider.types';
import { riderRepository } from './rider.repository';
import { getCachedRider, invalidateRiderCache } from '@/lib/server-cache';
import { clock } from '@/lib/clock';
import { verifyVerifyReceipt } from '@/lib/verify-receipt';
import { env } from '@/lib/env';

/** Test-mode placeholder URLs the Flutter app submits when TEST_MODE is on. */
const MOCK_URL_PREFIXES = ['mock_url_', 'mock-storage', 'mock_top_up_proof', 'mock_photo_'];

/** Reject test-mode document URLs outside dev/test — a leaked TEST_MODE
 *  client build must never persist fake KYC/guarantor evidence. */
function rejectMockDocumentUrls(
  ...fieldMaps: Array<Record<string, unknown>>
): void {
  if (env.APP_ENV !== 'staging' && env.APP_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    return;
  }
  for (const map of fieldMaps) {
    for (const value of Object.values(map)) {
      if (
        typeof value === 'string' &&
        MOCK_URL_PREFIXES.some((p) => value.startsWith(p))
      ) {
        throw new Error('Test-mode document URLs are not accepted in this environment');
      }
    }
  }
}

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
  // P1: `requiresHigherDeposit` is intentionally NOT rider-writable. It is a
  // server-owned surcharge flag (set by POST /api/rider/guarantor/skip or the
  // subscribe-time `guarantorSkipped` declaration, cleared when a real
  // guarantor is submitted). A rider clearing it via updateProfile would
  // dodge the skip-guarantor surcharge.
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
  // EDIT-PROFILE-AUDIT P0-3 (2026-09-08): `guarantorStatus`
  // removed from the allowlist. Status transitions are
  // server-only — the upsert at line ~1032 forces
  // `status: 'SUBMITTED'`. Mirrors the validators.ts removal.
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
    // P1 fix: must match ACTIVE_LEASE_STATUSES in getState below —
    // previously only BOOKED/ACTIVE, so OVERDUE leases (the ones that
    // need the prompt most) never prompted.
    const activeLease = await db.rentalLease.findFirst({
      where: {
        riderId: riderDbId,
        status: {
          in: ['BOOKED', 'PICKUP_SCHEDULED', 'ACTIVE', 'OVERDUE', 'RETURN_PENDING'],
        },
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

    // P2 fix: was ceil(rent)/floor(balance), inflating the shortfall by
    // up to ~₹2 (₹499.01 rent + ₹299.99 balance reported 500/299/201).
    // Symmetric rounding keeps the bias under ₹1 either way.
    const rentAmountInRupees = Math.round(activeLease.finalPriceInPaise / 100);
    const walletBalanceInRupees = Math.round(walletBalanceInPaise / 100);
    const shortfallInRupees = Math.max(0, rentAmountInRupees - walletBalanceInRupees);
    const recommendedTopUpRupees = shortfallInRupees > 0 ? shortfallInRupees : rentAmountInRupees;
    const isOverdue = msUntilDue < 0;

    // P2 fix: was server-local wall clock (UTC in prod → wrong time for
    // riders). Format explicitly in Asia/Kolkata, the operating timezone.
    const tzParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dueAt);
    const tzHourRaw = Number(
      tzParts.find((p) => p.type === 'hour')?.value ?? '0'
    );
    // en-GB hour12:false yields hour '24' at midnight — normalize to 0.
    const tzHour = tzHourRaw === 24 ? 0 : tzHourRaw;
    const tzMinutes = tzParts.find((p) => p.type === 'minute')?.value ?? '00';
    const ampm = tzHour >= 12 ? 'PM' : 'AM';
    const formattedHour = tzHour % 12 || 12;
    const formattedTime = `${formattedHour}:${tzMinutes} ${ampm}`;

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

    // P0 fix: the rider app never calls GET /api/rider/dashboard — the
    // profile endpoint is the live path, so the rent prompt must ride
    // along here or the proactive top-up card never renders. Fail-safe:
    // a rent-lookup failure degrades to null without failing the profile.
    // P1 fix: the dashboard degrades notification/rent failures to 0/null
    // — profile previously let any of them 500 the whole response.
    const [unreadNotificationCount, rewardAggregates, upcomingRentPrompt] = await Promise.all([
      db.notification
        .count({ where: { riderId: rider.id, isRead: false } })
        .catch((err: unknown) => {
          logger.error('[getProfile] unreadNotifications count failed', err);
          return 0;
        }),
      db.reward
        .aggregate({ where: { riderId: rider.id }, _sum: { points: true } })
        .catch((err: unknown) => {
          logger.error('[getProfile] reward aggregate failed', err);
          return { _sum: { points: 0 } };
        }),
      computeUpcomingRentPrompt(rider.id, rider.wallet?.balanceInPaise ?? 0),
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

    return stripRiderSecretsForRider({
      ...flatRider,
      vehicleModel,
      referralCode: rider.referralCode,
      unreadNotificationCount,
      totalRewardPoints: rewardAggregates._sum.points || 0,
    });
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
        // P1 fix: flattenRider reads pendingReturn.photoFront…/
        // createdAt for the submission banner — id+status alone left the
        // banner date permanently empty on this shape.
        vehicleReturns: {
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
        // P1 fix: the catch previously returned a 3-field stub, dropping
        // wallet/vehicle/plan the client requires. Fall back to the
        // unsigned flat rider (raw storage keys — the app already renders
        // those via its baseUrl prefix) so the shape stays intact.
        // P1 fix: strip location/compliance internals (see flatten-rider).
        const flatRider = stripRiderSecretsForRider(flattenRider(rider));
        if (rider.vehicle?.vehicleNumber) {
          flatRider.assignedVehicle = rider.vehicle.vehicleNumber;
        }
        try {
          const { signRiderUrls } = await import('@/lib/sign-rider');
          return await signRiderUrls(flatRider);
        } catch (err) {
          logger.error('[getDashboard] signRiderUrls failed', err);
          return flatRider;
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

      if (
        !SAFE_RIDER_FIELDS.has(key) &&
        !SAFE_KYC_FIELDS.has(key) &&
        !SAFE_GUARANTOR_FIELDS.has(key) &&
        key !== 'guarantorPhoneReceipt' &&
        key !== 'riderId' &&
        key !== 'returnPending' &&
        key !== 'returnPhotos' &&
        key !== 'returnReason' &&
        key !== 'latitude' &&
        key !== 'longitude'
      ) {
        // P2: unknown fields used to vanish silently (a typo'd client
        // field = silent no-op). Log so client/server drift is visible.
        logger.warn('[updateProfile] ignoring unknown field', { key });
        continue;
      }

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

    // P0: test-mode placeholder URLs must never persist outside dev/test.
    rejectMockDocumentUrls(kycData, guarantorData, riderData);

    // P1: riders must be 18+. The onboarding picker caps at today-18y;
    // enforce server-side too (raw API + admin paths bypass the picker).
    if (typeof riderData.dob === 'string' && riderData.dob.trim().length > 0) {
      const dobRaw = (riderData.dob as string).trim();
      const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobRaw);
      const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dobRaw);
      const parts = iso
        ? { y: +iso[1], m: +iso[2], d: +iso[3] }
        : dmy
          ? { y: +dmy[3], m: +dmy[2], d: +dmy[1] }
          : null;
      if (parts) {
        // P3 fix: reject impossible calendar dates (`new Date(2020, 1, 31)`
        // silently rolls over to Mar 2) and absurd years — the client
        // picker already floors at 1940.
        const dobDate = new Date(parts.y, parts.m - 1, parts.d);
        if (
          isNaN(dobDate.getTime()) ||
          dobDate.getFullYear() !== parts.y ||
          dobDate.getMonth() !== parts.m - 1 ||
          dobDate.getDate() !== parts.d
        ) {
          throw new RiderValidationError('Enter a valid date of birth');
        }
        if (parts.y < 1940) {
          throw new RiderValidationError('Enter a valid date of birth');
        }
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 18);
        if (dobDate > cutoff) {
          throw new RiderValidationError('Rider must be at least 18 years old');
        }
      }
    }

    // P2 fix: emergency contact may not be the rider's own number. The edit
    // screen validates this client-side; raw API calls bypassed it.
    if (typeof riderData.emergencyContact === 'string') {
      const cleanEmergency = (riderData.emergencyContact as string).replace(/\D/g, '');
      const cleanPhone = existing.phone ? String(existing.phone).replace(/\D/g, '') : '';
      if (cleanEmergency.length > 0 && cleanEmergency === cleanPhone) {
        throw new RiderValidationError('Emergency contact cannot be your own number');
      }
      if (cleanEmergency.length > 0 && cleanEmergency.length !== 10) {
        throw new RiderValidationError('Emergency contact must be 10 digits');
      }
    }

    // P1 fix (atomicity): every write below commits in ONE Prisma
    // $transaction. Previously rider/KYC/guarantor/return/lifecycle writes
    // committed piecemeal, so a mid-save throw left a half-applied profile.
    // All reads that gate writes are re-done on `tx` (never trusted from
    // the pre-transaction cache snapshot) and lifecycle moves go through
    // transitionRiderStatus(tx), whose CAS updateMany keeps concurrent
    // saves single-winner.
    const updated = await db.$transaction(async (tx: any) => {
    // Update core rider fields
    if (Object.keys(riderData).length > 0) {
      if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
        const name = riderData.fullName as string;
        const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
        riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
      }
      await tx.rider.update({ where: { id: riderDbId }, data: riderData });
    }

    // Handle vehicle returns.
    // P1: legacy chokepoint previously allowed ANY lifecycle state with any
    // vehicleId to file a return. Match submitReturn invariants: ACTIVE only,
    // ≥4 photos, then atomic create + RETURN_PENDING transition.
    if (input.returnPending === true && (input.returnPhotos as string[] | undefined)?.length) {
      const photos = input.returnPhotos as string[];
      // P1 fix: gate on a fresh in-tx status read, not the pre-transaction
      // cache snapshot (`existing`), which can be stale under concurrency.
      const freshForReturn = await tx.rider.findUnique({
        where: { id: riderDbId },
        select: { lifecycleStatus: true, vehicleId: true, assignedVehicle: true },
      });
      if (freshForReturn?.lifecycleStatus !== 'ACTIVE') {
        throw new Error('Vehicle return is only allowed while the rental is ACTIVE');
      }
      if (photos.length < 4) {
        throw new Error('At least 4 return photos are required');
      }
      let vehicleId = freshForReturn.vehicleId || null;
      if (!vehicleId && freshForReturn.assignedVehicle) {
        const vehicle = await tx.vehicle.findFirst({
          where: {
            OR: [
              { vehicleId: freshForReturn.assignedVehicle },
              { vehicleNumber: freshForReturn.assignedVehicle },
            ],
          },
          select: { id: true },
        });
        vehicleId = vehicle?.id || null;
      }
      if (!vehicleId) throw new Error('No vehicle assigned to this rider');

      // P1: reject duplicate open returns (submitReturn race-guards this;
      // the legacy path must too — otherwise two SUBMITTED rows per rider).
      const openReturn = await tx.vehicleReturn.findFirst({
        where: {
          riderId: riderDbId,
          status: { in: ['SUBMITTED', 'INSPECTION_PENDING'] },
        },
        select: { id: true },
      });
      if (openReturn) throw new Error('A vehicle return is already pending inspection');

      await tx.vehicleReturn.create({
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

      await transitionRiderStatus(riderDbId, 'RETURN_PENDING', tx);
    }

    // Update KYC profile.
    // P1: an APPROVED profile is locked server-side (editableFields = []).
    // The old code upserted any KYC field past approval, letting a rider
    // overwrite Aadhaar/PAN post-approval. Corrections require an admin
    // REJECT/INFO_REQUIRED first (which sets the editable allowlist).
    // Tracks whether a KYC row predates this save so the lifecycle block
    // below can tell first submission (may advance) from correction
    // (must never regress lifecycle backward).
    let hadKycRow = false;
    if (Object.keys(kycData).length > 0) {
      const kycExisting = await tx.kycProfile.findUnique({
        where: { riderId: riderDbId },
        select: { status: true, editableFields: true },
      });
      hadKycRow = !!kycExisting;
      if (kycExisting?.status === 'APPROVED') {
        throw new Error('KYC is approved and locked. Ask support to request changes first.');
      }
      // P0: enforce the admin-set editableFields allowlist on correction
      // resubmits. Previously any field could be overwritten past an
      // INFO_REQUIRED/REJECTED scoping — the allowlist was UI-only.
      // Aliases (bankAccount→accountNumber, bankIfsc→ifscCode,
      // selfie→profilePhoto) are accepted in either form.
      // P1 fix (default-deny): a REJECT/INFO_REQUIRED row with an empty or
      // missing allowlist used to reopen the ENTIRE KYC surface — the
      // scoping failed open on admin omission. Now it fails closed.
      if (
        kycExisting &&
        (kycExisting.status === 'INFO_REQUIRED' ||
          kycExisting.status === 'REJECTED')
      ) {
        const allowed = new Set(
          Array.isArray(kycExisting.editableFields) ? kycExisting.editableFields : []
        );
        const aliasOf: Record<string, string> = {
          bankAccount: 'accountNumber',
          bankIfsc: 'ifscCode',
          selfie: 'profilePhoto',
          accountNumber: 'bankAccount',
          ifscCode: 'bankIfsc',
          profilePhoto: 'selfie',
        };
        const blocked = Object.keys(kycData).filter(
          (k) => !allowed.has(k) && !allowed.has(aliasOf[k] ?? '')
        );
        if (blocked.length > 0) {
          throw new Error(
            `Only the requested corrections can be resubmitted right now (${blocked.join(', ')} is not editable). Ask support to request changes first.`
          );
        }
      }
      await tx.kycProfile.upsert({
        where: { riderId: riderDbId },
        create: { riderId: riderDbId, ...(kycData as any), status: 'SUBMITTED' },
        update: { ...(kycData as any), status: 'SUBMITTED' },
      });
    }

    // Update Guarantor
    if (Object.keys(guarantorData).length > 0) {
      // P2: an all-blank guarantor section (e.g. edit-profile with the
      // guarantor fields untouched) is a no-op — it must not create a
      // placeholder row nor throw.
      const guarantorVisible = [
        'name',
        'phone',
        'address',
        'relation',
        'dob',
        'aadhaarFront',
        'aadhaarBack',
        'pan',
        'video',
        'signature',
        'photo',
        'fatherName',
        'motherName',
      ].some(
        (k) =>
          typeof guarantorData[k] === 'string'
            ? (guarantorData[k] as string).trim().length > 0
            : guarantorData[k] !== undefined
      );
      if (!guarantorVisible) {
        // Drop the empty write entirely (stale keys already filtered above).
        for (const k of Object.keys(guarantorData)) delete guarantorData[k];
      }
    }
    if (Object.keys(guarantorData).length > 0) {
      // P1 fix: unchanged guarantor payloads are a no-op. The edit screen
      // resends every guarantor field on each save, and the old code
      // unconditionally upserted (resetting status to SUBMITTED), cleared
      // the skip-guarantor surcharge, and advanced lifecycle — a name-typo
      // fix resubmitted the whole guarantor. Compare normalized values
      // against the stored row first.
      const storedFull = await tx.guarantor.findUnique({
        where: { riderId: riderDbId },
      });
      const digitsOf = (v: unknown) => String(v ?? '').replace(/\D/g, '');
      const textOf = (v: unknown) => String(v ?? '').trim();
      const guarantorCompareKeys = [
        'name',
        'address',
        'relation',
        'dob',
        'aadhaarFront',
        'aadhaarBack',
        'pan',
        'video',
        'signature',
        'photo',
        'fatherName',
        'motherName',
      ];
      const guarantorMatchesStored = (): boolean => {
        if (!storedFull) return false;
        if (digitsOf(guarantorData.phone) !== digitsOf((storedFull as any).phone)) return false;
        return guarantorCompareKeys.every((k) => {
          const incoming = k === 'relation' && guarantorData[k] == null
            ? 'Other'
            : guarantorData[k];
          if (incoming === undefined) return true;
          return textOf(incoming) === textOf((storedFull as any)[k]);
        });
      };
      if (guarantorMatchesStored()) {
        for (const k of Object.keys(guarantorData)) delete guarantorData[k];
      }
    }
    if (Object.keys(guarantorData).length > 0) {
      if (guarantorData.phone) {
        const cleanGuarantorPhone = String(guarantorData.phone).replace(/\D/g, '');
        const cleanRiderPhone = existing.phone ? String(existing.phone).replace(/\D/g, '') : '';
        if (cleanGuarantorPhone.length > 0 && cleanGuarantorPhone === cleanRiderPhone) {
          throw new RiderValidationError('Guarantor phone cannot be the same as rider phone');
        }

        // P0: a signed OTP receipt is mandatory when the submitted phone
        // is new or changed. Previously the receipt was only validated
        // when present, so omitting it accepted any number with no OTP
        // proof. Unchanged numbers (equal to the stored guarantor phone)
        // skip the receipt — they were verified when first stored.
        const storedGuarantor = await tx.guarantor.findUnique({
          where: { riderId: riderDbId },
          select: { phone: true },
        });
        const cleanStored = storedGuarantor?.phone
          ? String(storedGuarantor.phone).replace(/\D/g, '')
          : '';
        const receipt = input.guarantorPhoneReceipt as string | undefined;
        if (cleanGuarantorPhone !== cleanStored) {
          if (!receipt) {
            throw new RiderValidationError('Guarantor phone verification is required. Please verify the new number with OTP first.');
          }
          // P1 fix: the receipt must be bound to THIS rider (verify-phone
          // binds the live session when present). Legacy/unbound receipts
          // are rejected here — re-verify from this account.
          const receiptCheck = verifyVerifyReceipt(receipt, cleanGuarantorPhone, riderDbId);
          if (!receiptCheck.valid) {
            throw new RiderValidationError(`Guarantor phone verification receipt is invalid: ${receiptCheck.reason}`);
          }
        } else if (receipt) {
          const receiptCheck = verifyVerifyReceipt(receipt, cleanGuarantorPhone, riderDbId);
          if (!receiptCheck.valid) {
            throw new RiderValidationError(`Guarantor phone verification receipt is invalid: ${receiptCheck.reason}`);
          }
        }
      }

      if (!guarantorData.relation) guarantorData.relation = 'Other';
      // P2: never persist placeholder PII — a guarantor row without a
      // real name + phone is junk that poisons fraud checks. Partial
      // saves must fail loudly instead.
      if (!guarantorData.name || !guarantorData.phone) {
        throw new RiderValidationError('Guarantor name and phone are required to save guarantor details');
      }
      await tx.guarantor.upsert({
        where: { riderId: riderDbId },
        create: {
          riderId: riderDbId,
          relation: (guarantorData.relation as string) || 'Other',
          ...(guarantorData as any),
          status: 'SUBMITTED',
        },
        update: { ...(guarantorData as any), status: 'SUBMITTED' },
      });
      // P1: a real guarantor submission (with a phone — not a partial form
      // save) lifts the skip-guarantor surcharge. The flag itself is never
      // rider-writable (see SAFE_RIDER_FIELDS).
      if (guarantorData.phone) {
        await tx.rider.update({
          where: { id: riderDbId },
          data: { requiresHigherDeposit: false },
        });
      }
    }

    // Advance lifecycle based on submissions.
    // P1 fix: single fresh in-tx status read (the old code read, wrote, and
    // re-read across three separate queries — TOCTOU under concurrent
    // saves), transitions via transitionRiderStatus(tx) so the CAS
    // updateMany keeps racers single-winner, and the DEPOSIT_APPROVED →
    // KYC_SUBMITTED move fires only on a FIRST KYC submission. A correction
    // to an existing KYC row previously regressed lifecycle backward.
    const lifecycleNow = await tx.rider.findUnique({
      where: { id: riderDbId },
      select: { lifecycleStatus: true },
    });

    if (lifecycleNow) {
      // 1. If Guarantor data is present, move from PROFILE_SUBMITTED to GUARANTOR_SUBMITTED (Guarantor Form completed)
      if (Object.keys(guarantorData).length > 0) {
        if (lifecycleNow.lifecycleStatus === 'PROFILE_SUBMITTED') {
          await transitionRiderStatus(riderDbId, 'GUARANTOR_SUBMITTED', tx);
        }
      }

      // 2. If KYC data is present, move forward for first submissions only.
      if (Object.keys(kycData).length > 0 && !hadKycRow) {
        if (lifecycleNow.lifecycleStatus === 'NEW') {
          await transitionRiderStatus(riderDbId, 'PHONE_VERIFIED', tx);
        }

        const statusAfterFirst = (
          await tx.rider.findUnique({
            where: { id: riderDbId },
            select: { lifecycleStatus: true },
          })
        )?.lifecycleStatus;
        if (statusAfterFirst === 'PHONE_VERIFIED' || statusAfterFirst === 'NEW') {
          await transitionRiderStatus(riderDbId, 'PROFILE_SUBMITTED', tx);
        }

        const statusAfterSecond = (
          await tx.rider.findUnique({
            where: { id: riderDbId },
            select: { lifecycleStatus: true },
          })
        )?.lifecycleStatus;
        if (statusAfterSecond === 'DEPOSIT_APPROVED') {
          await transitionRiderStatus(riderDbId, 'KYC_SUBMITTED', tx);
        }
      }
    }

    // Return updated profile (read inside the tx so the response reflects
    // exactly what committed).
    const rider = await tx.rider.findUnique({
      where: { id: riderDbId },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });
    if (!rider) return null;
    const flatRider = flattenRider(rider);
    let assignedVehicleNumber = flatRider.assignedVehicle;
    if (flatRider.assignedVehicle) {
      const v = await tx.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } });
      if (v) assignedVehicleNumber = v.vehicleNumber;
    }
    flatRider.assignedVehicle = assignedVehicleNumber;
    return flatRider;
    }); // end db.$transaction

    // Return updated profile (rider-facing: strip location/compliance
    // internals that the ...rest spread would otherwise leak).
    invalidateRiderCache(riderDbId);
    return updated ? stripRiderSecretsForRider(updated) : null;
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
