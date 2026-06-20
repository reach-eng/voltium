/**
 * flattenRider — Takes a Prisma rider with included relations and flattens
 * them into a single object for backward-compatible frontend consumption.
 *
 * Virtual computed fields:
 *   kycStatus         → from kycProfile.status (default "PENDING")
 *   walletBalance     → wallet.balanceInPaise / 100
 *   balance           → alias of walletBalance
 *   securityDeposit   → wallet.securityDeposit / 100
 *   depositStatus     → wallet.depositStatus (default "PENDING")
 *   paymentStreak     → wallet.paymentStreak (default 0)
 *   guarantorStatus   → guarantor.status (default "PENDING")
 *
 * All KYC, wallet, and guarantor fields are spread directly for compatibility.
 */

import type { Prisma } from '@prisma/client';
import { maskAadhaar, maskPan, maskPhone } from './pii';

type RiderWithRelations = Prisma.RiderGetPayload<{
  include: {
    kycProfile: true;
    wallet: true;
    guarantor: true;
    vehicleReturns: true;
  };
}>;

type RiderPartial = Prisma.RiderGetPayload<{
  include: {
    kycProfile?: boolean;
    wallet?: boolean;
    guarantor?: boolean;
  };
}>;

export function flattenRider(rider: RiderWithRelations) {
  const { kycProfile, wallet, guarantor, ...rest } = rider;

  const lifecycleStatus = rider.lifecycleStatus || 'NEW';
  const lifecycleRank: Record<string, number> = {
    NEW: 0, PHONE_VERIFIED: 1, PROFILE_SUBMITTED: 2, KYC_SUBMITTED: 3,
    KYC_APPROVED: 4, GUARANTOR_SUBMITTED: 5, GUARANTOR_APPROVED: 6,
    DEPOSIT_PENDING: 7, DEPOSIT_APPROVED: 8, PLAN_SELECTED: 9,
    PICKUP_SCHEDULED: 10, ACTIVE: 11, SUSPENDED: 12,
    RETURN_PENDING: 13, CLOSED: 14,
  };
  const rank = lifecycleRank[lifecycleStatus] ?? 0;
  const registrationDone = rank >= 2;
  const kycDone = rank >= 4;
  const depositDone = rank >= 8;
  const planDone = rank >= 9;
  const pickupDone = rank >= 10;

  return {
    ...rest,
    lifecycleStatus,
    state: lifecycleStatus,
    accountStatus: rank >= 11 ? 'ACTIVE' : rank >= 2 ? 'PRE_ACTIVE' : 'INACTIVE',
    rentalStatus: rank >= 11 ? 'ACTIVE' : 'NONE',
    planStatus: rank >= 9 ? 'ACTIVE' : 'NONE',
    registrationDone,
    kycDone,
    depositDone,
    planDone,
    pickupDone,
    name: rider.fullName ?? '', // Compatibility alias

    // --- KYC Profile fields ---
    kycStatus: kycProfile?.status || 'PENDING',
    profilePhoto: kycProfile?.profilePhoto ?? null,
    riderPhoto: kycProfile?.riderPhoto ?? null,
    signature: kycProfile?.signature ?? null,
    aadhaarFront: kycProfile?.aadhaarFront ?? null,
    aadhaarBack: kycProfile?.aadhaarBack ?? null,
    aadhaarNumber: maskAadhaar(kycProfile?.aadhaarNumber ?? null),
    panCard: kycProfile?.panCard ?? null,
    panNumber: maskPan(kycProfile?.panNumber ?? null),
    bankAccount: kycProfile?.accountNumber ?? null, // Fallback alias
    bankIfsc: kycProfile?.ifscCode ?? null, // Fallback alias
    bankName: kycProfile?.bankName ?? null,
    accountNumber: kycProfile?.accountNumber ?? null,
    ifscCode: kycProfile?.ifscCode ?? null,

    // --- Wallet fields (converted from paise → rupees) ---
    walletBalance: paiseToRupees(wallet?.balanceInPaise ?? 0),
    balance: paiseToRupees(wallet?.balanceInPaise ?? 0),
    securityDeposit: paiseToRupees(wallet?.securityDeposit ?? 0),
    depositStatus: wallet?.depositStatus || 'PENDING',
    paymentStreak: wallet?.paymentStreak ?? 0,

    // --- Guarantor fields ---
    guarantorStatus: guarantor?.status || 'PENDING',
    guarantorName: guarantor?.name ?? null,
    guarantorRelation: guarantor?.relation ?? null,
    guarantorDob: guarantor?.dob ?? null,
    guarantorPhone: maskPhone(guarantor?.phone ?? null),
    guarantorAadhaarFront: guarantor?.aadhaarFront ?? null,
    guarantorAadhaarBack: guarantor?.aadhaarBack ?? null,
    guarantorPan: guarantor?.pan ?? null,
    guarantorVideo: guarantor?.video ?? null,
    guarantorSignature: guarantor?.signature ?? null,
    guarantorFatherName: guarantor?.fatherName ?? null,
    guarantorMotherName: guarantor?.motherName ?? null,
    guarantorAddress: guarantor?.address ?? null,
    guarantorPhoto: guarantor?.photo ?? null,

    // --- Plan & Status fields (computed from lifecycleStatus above) ---
    currentPlan: rider.currentPlan ?? null,
    currentPlanPrice: rider.currentPlanPrice ?? null,
    assignedVehicle: rider.assignedVehicle ?? null,
    vehicleId: rider.vehicleId ?? null,
    planStartDate: rider.planStartDate ? new Date(rider.planStartDate as Date).toISOString() : null,
    planEndDate: rider.planEndDate ? new Date(rider.planEndDate as Date).toISOString() : null,

    // --- Rental Return fields ---
    returnPending: rider.vehicleReturns?.some((v: any) => v.status === 'SUBMITTED') ?? false,
    ...(() => {
      const pendingReturn = rider.vehicleReturns?.find((v: any) => v.status === 'SUBMITTED');
      if (!pendingReturn) return {};
      return {
        photoFront: pendingReturn.photoFront,
        photoBack: pendingReturn.photoBack,
        photoLeft: pendingReturn.photoLeft,
        photoRight: pendingReturn.photoRight,
        photoSpeedometer: pendingReturn.photoSpeedometer,
        submissionDate: pendingReturn.createdAt,
        scooterSubmissionDate: pendingReturn.createdAt,
        returnPhotos: {
          front: pendingReturn.photoFront,
          back: pendingReturn.photoBack,
          left: pendingReturn.photoLeft,
          right: pendingReturn.photoRight,
          speedometer: pendingReturn.photoSpeedometer,
        },
      };
    })(),
  };
}

/**
 * For routes that include a partial set of relations (e.g. only kycProfile).
 */
export function flattenRiderPartial(rider: RiderPartial & Record<string, unknown>) {
  const lifecycleStatus = (rider.lifecycleStatus as string) || 'NEW';
  const lifecycleRank: Record<string, number> = {
    NEW: 0, PHONE_VERIFIED: 1, PROFILE_SUBMITTED: 2, KYC_SUBMITTED: 3,
    KYC_APPROVED: 4, GUARANTOR_SUBMITTED: 5, GUARANTOR_APPROVED: 6,
    DEPOSIT_PENDING: 7, DEPOSIT_APPROVED: 8, PLAN_SELECTED: 9,
    PICKUP_SCHEDULED: 10, ACTIVE: 11, SUSPENDED: 12,
    RETURN_PENDING: 13, CLOSED: 14,
  };
  const rank = lifecycleRank[lifecycleStatus] ?? 0;
  const result: Record<string, unknown> = {
    ...rider,
    lifecycleStatus,
    state: lifecycleStatus,
    accountStatus: rank >= 11 ? 'ACTIVE' : rank >= 2 ? 'PRE_ACTIVE' : 'INACTIVE',
    rentalStatus: rank >= 11 ? 'ACTIVE' : 'NONE',
    planStatus: rank >= 9 ? 'ACTIVE' : 'NONE',
    registrationDone: rank >= 2,
    kycDone: rank >= 4,
    depositDone: rank >= 8,
    planDone: rank >= 9,
    pickupDone: rank >= 10,
    name: rider.fullName ?? '', // Compatibility alias
  };

  // Flatten kycProfile if present
  if (rider.kycProfile) {
    const kyc = rider.kycProfile as Record<string, unknown>;
    result.kycStatus = kyc.status || 'PENDING';
    result.profilePhoto = kyc.profilePhoto ?? null;
    result.riderPhoto = kyc.riderPhoto ?? null;
    result.signature = kyc.signature ?? null;
    result.aadhaarFront = kyc.aadhaarFront ?? null;
    result.aadhaarBack = kyc.aadhaarBack ?? null;
    result.aadhaarNumber = maskAadhaar((kyc.aadhaarNumber as string) ?? null);
    result.panCard = kyc.panCard ?? null;
    result.panNumber = maskPan((kyc.panNumber as string) ?? null);
    result.bankAccount = kyc.accountNumber ?? null;
    result.bankIfsc = kyc.ifscCode ?? null;
    result.bankName = kyc.bankName ?? null;
    result.accountNumber = kyc.accountNumber ?? null;
    result.ifscCode = kyc.ifscCode ?? null;
  }

  // Flatten wallet if present
  if (rider.wallet) {
    const w = rider.wallet as Record<string, unknown>;
    result.walletBalance = paiseToRupees((w.balanceInPaise ?? 0) as number);
    result.balance = paiseToRupees((w.balanceInPaise ?? 0) as number);
    result.securityDeposit = paiseToRupees((w.securityDeposit ?? 0) as number);
    result.depositStatus = (w.depositStatus as string) || 'PENDING';
    result.paymentStreak = (w.paymentStreak as number) ?? 0;
  }

  // Flatten guarantor if present
  if (rider.guarantor) {
    const g = rider.guarantor as Record<string, unknown>;
    result.guarantorStatus = g.status || 'PENDING';
    result.guarantorName = g.name ?? null;
    result.guarantorRelation = g.relation ?? null;
    result.guarantorDob = g.dob ?? null;
    result.guarantorPhone = maskPhone((g.phone as string) ?? null);
    result.guarantorFatherName = g.fatherName ?? null;
    result.guarantorMotherName = g.motherName ?? null;
    result.guarantorAadhaarFront = g.aadhaarFront ?? null;
    result.guarantorAadhaarBack = g.aadhaarBack ?? null;
    result.guarantorPan = g.pan ?? null;
    result.guarantorVideo = g.video ?? null;
    result.guarantorSignature = g.signature ?? null;
    result.guarantorAddress = g.address ?? null;
    result.guarantorPhoto = g.photo ?? null;
  }

  // Explicitly map Plan fields
  result.currentPlan = 'currentPlan' in rider ? rider.currentPlan : result.currentPlan || null;

  if (rider.vehicleReturns) {
    const vr = rider.vehicleReturns as any[];
    const pendingReturn = vr.find((v) => v.status === 'SUBMITTED');
    result.returnPending = !!pendingReturn;
    if (pendingReturn) {
      result.photoFront = pendingReturn.photoFront;
      result.photoBack = pendingReturn.photoBack;
      result.photoLeft = pendingReturn.photoLeft;
      result.photoRight = pendingReturn.photoRight;
      result.photoSpeedometer = pendingReturn.photoSpeedometer;
      result.submissionDate = pendingReturn.createdAt;
      result.scooterSubmissionDate = pendingReturn.createdAt;
    }
  } else if (!('returnPending' in result)) {
    result.returnPending = false;
  }

  // Remove the nested relation objects
  delete result.kycProfile;
  delete result.wallet;
  delete result.guarantor;

  return result;
}

/**
 * Helper: convert an amount in paise (Int) to rupees (Float).
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Helper: convert an amount in rupees to paise (Int).
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
