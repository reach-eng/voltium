/**
 * Riders module - Use cases.
 *
 * Orchestrates rider profile management, onboarding state, and lifecycle transitions.
 * All field-level security (field allowlists), relation upserts, and state transitions
 * are handled here — routes stay thin.
 */

import { db } from '@/lib/db';
import { flattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import type { RiderProfileUpdate, RiderState } from './rider.types';
import { riderRepository } from './rider.repository';

// Field allowlists for mass-assignment protection
const SAFE_RIDER_FIELDS = new Set([
  'fullName', 'email', 'fatherName', 'motherName', 'dob', 'currentAddress',
  'emergencyContact', 'intent', 'locationGranted', 'batteryGranted',
  'contactsGranted', 'callLogsGranted', 'micGranted', 'cameraGranted', 'phoneGranted',
]);

const SAFE_KYC_FIELDS = new Set([
  'profilePhoto', 'riderPhoto', 'signature', 'aadhaarFront', 'aadhaarBack',
  'aadhaarNumber', 'panCard', 'panNumber', 'bankAccount', 'bankIfsc',
  'bankName', 'accountNumber', 'ifscCode', 'selfie',
]);

const SAFE_GUARANTOR_FIELDS = new Set([
  'guarantorName', 'guarantorPhone', 'guarantorRelation', 'guarantorDob',
  'guarantorFatherName', 'guarantorMotherName', 'guarantorAddress',
  'guarantorAadhaarFront', 'guarantorAadhaarBack', 'guarantorPan',
  'guarantorVideo', 'guarantorSignature', 'guarantorPhoto', 'guarantorStatus',
]);

export const riderUseCases = {
  /**
   * Gets full rider profile with all relations.
   */
  async getProfile(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: {
        kycProfile: true,
        wallet: true,
        guarantor: true,
        vehicleReturns: true,
      },
    });
    if (!rider) return null;

    const [unreadNotificationCount, rewardAggregates] = await Promise.all([
      db.notification.count({ where: { riderId: rider.id, isRead: false } }),
      db.reward.aggregate({ where: { riderId: rider.id }, _sum: { points: true } }),
    ]);

    const flatRider = flattenRider(rider);
    return {
      ...flatRider,
      referralCode: rider.referralCode,
      unreadNotificationCount,
      totalRewardPoints: rewardAggregates._sum.points || 0,
    };
  },

  /**
   * Get full dashboard data for a rider.
   */
  async getDashboard(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        id: true, riderId: true, fullName: true, phone: true, state: true,
        accountStatus: true, rentalStatus: true, planStatus: true, currentPlan: true,
        planStartDate: true, planEndDate: true, referralCode: true, pickupHub: true,
        teamLeader: true, emergencyContact: true,
        pickupPhotoFront: true, pickupPhotoBack: true, pickupPhotoLeft: true,
        pickupPhotoRight: true, pickupPhotoWithVehicle: true,
        kycProfile: { select: { status: true, profilePhoto: true, riderPhoto: true, signature: true, aadhaarFront: true, aadhaarBack: true, aadhaarNumber: true, panCard: true, panNumber: true, bankName: true, accountNumber: true, ifscCode: true } },
        wallet: { select: { balanceInPaise: true, securityDeposit: true, depositStatus: true, paymentStreak: true } },
        guarantor: { select: { status: true, name: true, relation: true, dob: true, phone: true, signature: true } },
        vehicleReturns: { select: { id: true, status: true } },
        vehicle: { select: { id: true, vehicleId: true, vehicleNumber: true, model: true, batteryLevel: true, hub: { select: { id: true, name: true, location: true } } } },
      },
    });
    if (!rider) return null;

    const unreadNotifications = await db.notification.count({ where: { riderId: riderDbId, isRead: false } });

    let referralCode = rider.referralCode;
    if (!referralCode) {
      const namePart = (rider.fullName || 'VOLT').slice(0, 4).toUpperCase();
      const idPart = (rider.riderId || '0000000000').slice(-6);
      referralCode = `${namePart}${idPart}`;
    }

    let planDaysRemaining: number | null = null;
    if (rider.planStatus === 'ACTIVE' && rider.planEndDate) {
      const diffMs = rider.planEndDate.getTime() - Date.now();
      planDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    let signedRider: any = null;
    try {
      const flatRider = flattenRider(rider as any);
      const { signRiderUrls } = await import('@/lib/sign-rider');
      signedRider = await signRiderUrls(flatRider);
    } catch {
      signedRider = { id: rider.id, fullName: rider.fullName, riderId: rider.riderId };
    }

    return {
      rider: signedRider, referralCode, unreadNotifications,
      todayStats: { distance: 0, power: 0, speed: 0, battery: 0 },
      planDaysRemaining,
    };
  },

  /**
   * Get rewards for a rider.
   */
  async getRewards(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { wallet: { select: { paymentStreak: true } } },
    });
    if (!rider) return null;

    const [rewards, aggregates] = await Promise.all([
      db.reward.findMany({ where: { riderId: riderDbId }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, title: true, points: true, createdAt: true } }),
      db.reward.aggregate({ where: { riderId: riderDbId }, _sum: { points: true } }),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthRewards = rewards.filter((r) => new Date(r.createdAt) >= monthStart);
    const thisMonthPoints = thisMonthRewards.reduce((sum, r) => sum + r.points, 0);

    return { rewards, totalPoints: aggregates._sum.points || 0, thisMonthPoints, currentStreak: rider.wallet?.paymentStreak ?? 0 };
  },

  /**
   * Register FCM token for a rider.
   */
  async registerFcmToken(riderId: string, fcmToken: string) {
    const rider = await db.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new Error('Rider not found');
    await db.rider.update({ where: { id: riderId }, data: { fcmToken } });
  },

  /**
   * List earnings for a rider with pagination and filters.
   */
  async listEarnings(riderId: string, filters: { startDate?: string; endDate?: string; platform?: string; page: number; limit: number }) {
    const { startDate, endDate, platform, page, limit } = filters;
    const where: Record<string, unknown> = { riderId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as any).gte = new Date(startDate);
      if (endDate) (where.date as any).lte = new Date(endDate);
    }
    if (platform) where.platform = platform;

    const [earnings, total] = await Promise.all([
      db.riderEarning.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.riderEarning.count({ where }),
    ]);

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklySummary = await db.riderEarning.aggregate({
      where: { riderId, date: { gte: startOfWeek } },
      _sum: { amount: true, trips: true, distance: true, hoursOnline: true },
      _count: { id: true },
    });

    return {
      earnings, weeklySummary: {
        totalEarnings: weeklySummary._sum.amount ?? 0,
        totalTrips: weeklySummary._sum.trips ?? 0,
        totalDistance: weeklySummary._sum.distance ?? 0,
        totalHoursOnline: weeklySummary._sum.hoursOnline ?? 0,
        daysWorked: weeklySummary._count.id ?? 0,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Create an earning record for a rider.
   */
  async createEarning(riderId: string, data: { date: string; platform?: string; amount: number; trips: number; distance?: number; hoursOnline?: number; notes?: string }) {
    return db.riderEarning.create({ data: { riderId, date: new Date(data.date), platform: data.platform || null, amount: data.amount, trips: data.trips, distance: data.distance || null, hoursOnline: data.hoursOnline || null, notes: data.notes || null } });
  },

  /**
   * Update rider profile with field-level security.
   * Handles safe rider fields, KYC fields, guarantor fields, and vehicle returns.
   */
  async updateProfile(riderDbId: string, input: Record<string, unknown>) {
    const existing = await db.rider.findUnique({ where: { id: riderDbId } });
    if (!existing) throw new Error('Rider not found');

    const riderData: Record<string, unknown> = {};
    const kycData: Record<string, unknown> = {};
    const guarantorData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (SAFE_RIDER_FIELDS.has(key)) {
        riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      } else if (SAFE_KYC_FIELDS.has(key)) {
        if (key === 'bankAccount') kycData['accountNumber'] = value;
        else if (key === 'bankIfsc') kycData['ifscCode'] = value;
        else if (key === 'selfie') kycData['profilePhoto'] = value;
        else kycData[key] = value;
      } else if (SAFE_GUARANTOR_FIELDS.has(key)) {
        const dbKey = key.charAt(9).toLowerCase() + key.slice(10);
        guarantorData[dbKey] = value;
      }
    }

    // Update core rider fields
    if (Object.keys(riderData).length > 0) {
      await db.rider.update({ where: { id: riderDbId }, data: riderData });
    }

    // Handle vehicle returns
    if (
      input.returnPending === true &&
      (input.returnPhotos as string[] | undefined)?.length
    ) {
      const photos = input.returnPhotos as string[];
      const vehicleId = existing.vehicleId || existing.assignedVehicle;
      if (!vehicleId) throw new Error('No vehicle assigned to this rider');

      await db.vehicleReturn.create({
        data: {
          riderId: riderDbId,
          vehicleId,
          status: 'PENDING',
          photoLeft: photos[0],
          photoRight: photos[1],
          photoFront: photos[2],
          photoSpeedometer: photos[3],
          latitude: input.latitude as number | undefined,
          longitude: input.longitude as number | undefined,
          reason: (input.returnReason as string) || 'End of rental',
        },
      });

      await db.rider.update({
        where: { id: riderDbId },
        data: { rentalStatus: 'PENDING_RETURN' },
      });
    }

    // Update KYC profile
    if (Object.keys(kycData).length > 0) {
      await db.kycProfile.upsert({
        where: { riderId: riderDbId },
        create: { riderId: riderDbId, ...kycData as any, status: 'SUBMITTED' },
        update: { ...kycData as any, status: 'SUBMITTED' },
      });
    }

    // Update Guarantor
    if (Object.keys(guarantorData).length > 0) {
      if (!guarantorData.relation) guarantorData.relation = 'Other';
      await db.guarantor.upsert({
        where: { riderId: riderDbId },
        create: {
          riderId: riderDbId,
          name: (guarantorData.name as string) || 'N/A',
          relation: (guarantorData.relation as string) || 'Other',
          phone: (guarantorData.phone as string) || '0000000000',
          ...guarantorData as any,
          status: 'SUBMITTED',
        },
        update: { ...guarantorData as any, status: 'SUBMITTED' },
      });
    }

    // Return updated profile
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });
    return rider ? flattenRider(rider) : null;
  },

  async getState(riderDbId: string): Promise<RiderState | null> {
    const rider = await riderRepository.getFullState(riderDbId);
    if (!rider) return null;
    throw new Error('Not implemented');
  },
};
