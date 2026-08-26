/**
 * Rider module — Profile, Dashboard, State & Lifecycle Operations
 *
 * Core rider profile queries, rental dashboard aggregation, upcoming rent computations,
 * state machine evaluation, and profile updates.
 */

import { db } from '@/lib/db';
import { RentalStatus } from '@prisma/client';
import { flattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import type { RiderState } from './rider.types';
import { riderRepository } from './rider.repository';
import { getCachedRider, invalidateRiderCache } from '@/lib/server-cache';
import { clock } from '@/lib/clock';
import { verifyVerifyReceipt } from '@/lib/verify-receipt';
import { signRiderUrls } from '@/lib/sign-rider';

export const GUARANTOR_FIELD_TO_DB: Record<string, string> = {
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

export const SAFE_RIDER_FIELDS = new Set([
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
  'preferredLocale',
]);

export const SAFE_KYC_FIELDS = new Set([
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

export const SAFE_GUARANTOR_FIELDS = new Set([
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

export async function computeUpcomingRentPrompt(
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

export async function getRiderProfile(riderDbId: string) {
  const rider = await getCachedRider(riderDbId, () =>
    db.rider.findUnique({
      where: { id: riderDbId },
      include: {
        kycProfile: true,
        wallet: true,
        guarantor: true,
        vehicleReturns: true,
        currentPlanRef: true,
        teamLeaderRef: { select: { id: true, name: true, phone: true } },
        pickupHubRef: { select: { id: true, name: true, location: true } },
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
  if (vehicleModel) {
    flatRider.vehicleModel = vehicleModel;
  }

  return signRiderUrls({
    ...flatRider,
    referralCode: rider.referralCode,
    unreadNotificationCount,
    totalRewardPoints: rewardAggregates._sum.points || 0,
  });
}

export async function rejectPlan(riderDbId: string, adminId: string, reason: string) {
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
}

export async function getDashboard(riderDbId: string) {
  return getRiderDashboard(riderDbId);
}

export async function getRiderDashboard(riderDbId: string) {
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
      currentPlanRef: {
        select: {
          id: true,
          name: true,
          type: true,
          priceInPaise: true,
          durationDays: true,
          securityDepositInPaise: true,
          isSecurityRefundable: true,
          refundableAfterDays: true,
        },
      },
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

  let referralCode = rider.referralCode;
  if (!referralCode) {
    const namePart = (rider.fullName || 'VOLT').slice(0, 4).toUpperCase();
    const idPart = (rider.riderId || '0000000000').slice(-6);
    referralCode = `${namePart}${idPart}`;
    void db.rider
      .update({
        where: { id: riderDbId },
        data: { referralCode },
      })
      .catch((err: unknown) => {
        logger.error('[getDashboard] Failed to persist generated referral code', err);
      });
  }

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
        if (rider.vehicle?.model) {
          flatRider.vehicleModel = rider.vehicle.model;
        }
        const { signRiderUrls } = await import('@/lib/sign-rider');
        return await signRiderUrls(flatRider);
      } catch (err) {
        logger.error('[getDashboard] signRiderUrls failed', err);
        return flattenRider(rider);
      }
    })(),
    computeUpcomingRentPrompt(riderDbId, rider.wallet?.balanceInPaise ?? 0),
  ]);

  return {
    rider: signedRider,
    referralCode,
    unreadNotifications,
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
}

export async function registerFcmToken(riderDbId: string, fcmToken: string) {
  const rider = await getCachedRider(riderDbId, () => db.rider.findUnique({ where: { id: riderDbId } }));
  if (!rider) throw new Error('Rider not found');
  await db.rider.update({ where: { id: riderDbId }, data: { fcmToken } });
  invalidateRiderCache(riderDbId);
}

export async function updateRiderProfile(riderDbId: string, input: Record<string, unknown>) {
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
      const sanitized = typeof value === 'string' ? sanitizeText(value) : value;
      if (key === 'bankAccount') kycData['accountNumber'] = sanitized;
      else if (key === 'bankIfsc') kycData['ifscCode'] = sanitized;
      else if (key === 'selfie') kycData['profilePhoto'] = sanitized;
      else kycData[key] = sanitized;
    } else if (SAFE_GUARANTOR_FIELDS.has(key)) {
      const dbKey =
        GUARANTOR_FIELD_TO_DB[key] ??
        (key.startsWith('guarantor')
          ? key.charAt(9).toLowerCase() + key.slice(10)
          : key);
      guarantorData[dbKey] = typeof value === 'string' ? sanitizeText(value) : value;
    }
  }

  if (Object.keys(riderData).length > 0) {
    if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
      const name = riderData.fullName as string;
      const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
      riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
    }
    await db.rider.update({ where: { id: riderDbId }, data: riderData });
  }

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

  if (Object.keys(kycData).length > 0) {
    await db.kycProfile.upsert({
      where: { riderId: riderDbId },
      create: { riderId: riderDbId, ...(kycData as any), status: 'SUBMITTED' },
      update: { ...(kycData as any), status: 'SUBMITTED' },
    });
  }

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

  const currentRider = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
  
  if (currentRider) {
    if (Object.keys(guarantorData).length > 0) {
      const freshStatus = await db.rider.findUnique({ where: { id: riderDbId }, select: { lifecycleStatus: true } });
      if (freshStatus?.lifecycleStatus === 'PROFILE_SUBMITTED') {
        await transitionRiderStatus(riderDbId, 'GUARANTOR_SUBMITTED');
      }
    }

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
  return signRiderUrls(flatRider);
}

export async function getRiderState(riderDbId: string): Promise<RiderState | null> {
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
    walletBalance: (rider.wallet?.balanceInPaise || 0) / 100,
  };
}
