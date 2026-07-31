/**
 * Admin Riders — List & Search
 *
 * List riders with full filters, search, pagination, shared guarantor detection.
 * Fleet listing with vehicle and location data.
 */

import { db } from '@/lib/db';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { signRiderUrlsWithProvider } from '@/lib/sign-rider';
import { getFeatureFlags } from '@/lib/feature-flags';
import { ValidationError } from "@/lib/api-error";

/**
 * List riders with full filters, search, pagination, and shared guarantor detection.
 */
export async function listRiders(filters: {
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
  const {
    search,
    state,
    kycStatus,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortDir = 'desc',
  } = filters;

  if (kycStatus && !flags.enableKYCVerification) {
    throw new ValidationError('KYC verification is currently disabled');
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
        lifecycleStatus: true,
        pickupHub: true,
        pickedUpAt: true,
        registrationDoneAt: true,
        depositDoneAt: true,
        kycDoneAt: true,
        planDoneAt: true,
        teamLeader: true,
        planStartDate: true,
        planEndDate: true,
        currentPlan: true,
        currentPlanPrice: true,
        assignedVehicle: true,
        vehicleId: true,
        intent: true,
        referralCode: true,
        fatherName: true,
        motherName: true,
        dob: true,
        currentAddress: true,
        createdAt: true,
        updatedAt: true,
        pickupPhotoFront: true,
        pickupPhotoBack: true,
        pickupPhotoLeft: true,
        pickupPhotoRight: true,
        pickupPhotoWithVehicle: true,
        deliveryId: true,
        locationGranted: true,
        batteryGranted: true,
        contactsGranted: true,
        callLogsGranted: true,
        micGranted: true,
        cameraGranted: true,
        phoneGranted: true,
        emergencyContact: true,
        preferredShift: true,
        referredBy: true,
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
            securityDeposit: true,
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
  const sharedCache = new Map<string, string>();
  const signed = await Promise.all(
    flat.map(async (r: any) => signRiderUrlsWithProvider(r, storage, sharedCache))
  );

  return {
    riders: signed,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    flags: {
      enableKYCVerification: flags.enableKYCVerification,
      enableGuarantorRequirement: flags.enableGuarantorRequirement,
    },
  };
}

