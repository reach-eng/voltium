/**
 * Admin Riders — Query & Search
 *
 * List riders with full filters, search, pagination, and shared guarantor detection.
 */

import { db } from '@/lib/db';
import { Prisma, RiderLifecycleStatus, KycStatus } from '@prisma/client';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { signRiderUrlsWithProvider } from '@/lib/sign-rider';
import { getFeatureFlags } from '@/lib/feature-flags';

export async function listRiders(filters: {
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
        deletedAt: true,
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
}
