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
import { lifecycleRankOf } from './lifecycle-ranks';
import { maskAadhaar, maskAccountNumber, maskPan, maskPhone } from './pii';

type RiderWithRelations = Prisma.RiderGetPayload<{
  include: {
    kycProfile: true;
    wallet: true;
    guarantor: true;
    vehicleReturns: true;
    vehicle: { select: { vehicleNumber: true; model: true } };
  };
}>;

type RiderPartial = Prisma.RiderGetPayload<{
  include: {
    kycProfile?: boolean;
    wallet?: boolean;
    guarantor?: boolean;
  };
}>;

export function flattenRider(
  rider: RiderWithRelations | RiderPartial | Record<string, unknown>
) {
  // Typed sweep (2026-08-16): callers load riders with varying select/
  // include shapes (vehicle hub, kycProfile select, etc.) that never matched
  // the exact `RiderWithRelations` payload. The union loosens the boundary
  // while the cast keeps the serializer body fully typed.
  const r = rider as RiderWithRelations;
  // P0-S1 / F-095: Explicitly deny-list and drop sensitive secrets and internal tokens from the rest spread
  const {
    kycProfile,
    wallet,
    guarantor,
    lockPassword: _lockPassword,
    lockPasswordHash: _lockPasswordHash,
    otp: _otp,
    otpExpiresAt: _otpExpiresAt,
    otpAttempts: _otpAttempts,
    password: _password,
    passwordHash: _passwordHash,
    fcmToken: _fcmToken,
    tokenVersion: _tokenVersion,
    token: _token,
    refreshToken: _refreshToken,
    ...rest
  } = r as any;

  const lifecycleStatus = r.lifecycleStatus || 'NEW';
  // DEEP-AUDIT D-P1-2 (2026-08-08): the local lifecycleRank map was
  // removed. Both flattenRider and flattenRiderPartial now use the
  // canonical LIFECYCLE_RANK from lifecycle-ranks.ts. The threshold
  // numbers below were re-derived from the canonical map. Behavior
  // changes for the rider app:
  //   - registrationDone: was rank >= 3 (GUARANTOR_*), now rank >= 2
  //     (PROFILE_SUBMITTED). "Registration done" now means the
  //     profile is in, not that guarantor is approved.
  //   - kycDone: was rank >= 8, now rank >= 4 (KYC_APPROVED — same
  //     status, just different numeric rank).
  //   - depositDone: was rank >= 6, now rank >= 8 (DEPOSIT_APPROVED).
  //   - planDone: was rank >= 4 (PLAN_SELECTED), now rank >= 9
  //     (PLAN_SELECTED — same status, different rank).
  //   - pickupDone: was rank >= 10 (PICKUP_SCHEDULED), now rank >= 11
  //     (ACTIVE). PICKUP_SCHEDULED means "pickup is scheduled but the
  //     rider hasn't actually picked up yet" — they are still waiting
  //     on the hangTight screen for admin to flip them to ACTIVE.
  //     Setting pickupDone = true at rank 10 caused the hangTight
  //     auto-redirect to fire immediately and skip the admin-approval
  //     wait (also made the hangTight branch in the lifecycle gate
  //     unreachable since the first check `pickupDone || rank >= 11`
  //     matched first). The correct semantic is "the rider has
  //     actually been activated", which happens at rank 11 (ACTIVE).
  // The statuses these flags mean are unchanged — only the numeric
  // thresholds are.
  const rank = lifecycleRankOf(lifecycleStatus);
  const registrationDone = rank >= 2;
  const kycDone = kycProfile?.status === 'APPROVED' || rank >= 10;
  const depositDone = wallet?.depositStatus === 'APPROVED' || (wallet?.securityDepositInPaise ?? 0) > 0 || rank >= 10;
  const planDone = !!r.currentPlan || rank >= 9;
  const pickupDone = rank >= 11 || !!r.pickedUpAt;

  return {
    ...rest,
    lifecycleStatus,
    state: lifecycleStatus,
    accountStatus: rank >= 11 ? 'ACTIVE' : rank >= 2 ? 'PRE_ACTIVE' : 'INACTIVE',
    rentalStatus: rank >= 11 ? 'ACTIVE' : 'NONE',
    planStatus: rank >= 4 ? 'ACTIVE' : 'NONE',
    registrationDone,
    kycDone,
    depositDone,
    planDone,
    pickupDone,
    name: r.fullName ?? '', // Compatibility alias

    // --- KYC Profile fields ---
    kycStatus: kycProfile?.status || 'PENDING',
    kycRejectionReason: (kycProfile as any)?.rejectionReason ?? null,
    kycEditableFields: (kycProfile as any)?.editableFields ?? null,
    profilePhoto: kycProfile?.profilePhoto ?? null,
    riderPhoto: kycProfile?.riderPhoto ?? null,
    signature: kycProfile?.signature ?? null,
    aadhaarFront: kycProfile?.aadhaarFront ?? null,
    aadhaarBack: kycProfile?.aadhaarBack ?? null,
    aadhaarNumber: maskAadhaar(kycProfile?.aadhaarNumber ?? null),
    panCard: kycProfile?.panCard ?? null,
    panNumber: maskPan(kycProfile?.panNumber ?? null),
    bankAccount: maskAccountNumber(kycProfile?.accountNumber ?? null), // Fallback alias (PR-5: P0-3 PII strip)
    bankIfsc: kycProfile?.ifscCode ?? null, // Fallback alias
    bankName: kycProfile?.bankName ?? null,
    accountNumber: maskAccountNumber(kycProfile?.accountNumber ?? null), // PR-5: RIDER_DASHBOARD P0-3 — mask PII
    ifscCode: kycProfile?.ifscCode ?? null,

    // --- Wallet fields (converted from paise → rupees) ---
    walletBalance: paiseToRupees(wallet?.balanceInPaise ?? 0),
    balance: paiseToRupees(wallet?.balanceInPaise ?? 0),
    securityDeposit: paiseToRupees(wallet?.securityDepositInPaise ?? 0),
    depositStatus: wallet?.depositStatus || 'PENDING',
    paymentStreak: wallet?.paymentStreak ?? 0,

    // --- Guarantor fields ---
    guarantorStatus: guarantor?.status || 'PENDING',
    guarantorName: guarantor?.name ?? null,
    guarantorRelation: guarantor?.relation ?? null,
    guarantorDob: guarantor?.dob ?? null,
    guarantorPhone: guarantor?.phone ?? null,
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
    currentPlan: r.currentPlan ?? null,
    currentPlanId: r.currentPlanId ?? null,
    currentPlanPrice: r.currentPlanPrice ?? null,
    advanceRentPaid: r.advanceRentPaid ?? false,
    // PR-47 (WALLET P1-1): the rider's current plan's security deposit
    // (in paise, server-side; client converts). Joined via the FK
    // `currentPlanRef` set in the rider select. Replaces the
    // `AppConstants.planSecurityDepositRupees` hardcoded map.
    currentPlanSecurityDepositInPaise:
      (rider as any).currentPlanRef?.securityDepositInPaise ??
      (rider as any).wallet?.securityDepositInPaise ??
      null,
    currentPlanIsSecurityRefundable:
      (rider as any).currentPlanRef?.isSecurityRefundable ?? true,
    currentPlanRefundableAfterDays:
      (rider as any).currentPlanRef?.refundableAfterDays ?? 180,
    assignedVehicle: (rider as any).vehicle?.vehicleNumber ?? r.assignedVehicle ?? null,
    activeVehicle: (rider as any).vehicle?.vehicleNumber ?? r.assignedVehicle ?? null,
    vehicleId: r.vehicleId ?? (rider as any).vehicle?.id ?? null,
    vehicleModel: (rider as any).vehicle?.model ?? null,
    // AUDIT FIX (data-population): EndRentalScreen reads batteryPercent
    // from the rider model, but flattenRider never mapped it from the
    // vehicle relation — always "Unavailable".
    batteryPercent: (rider as any).vehicle?.batteryLevel ?? null,
    deliveryId: r.deliveryId ?? null,
    intent: r.intent ?? null,
    emergencyContact: r.emergencyContact ?? null,
    pickupHub: (rider as any).pickupHubRef?.name ?? r.pickupHub ?? null,
    teamLeader: (rider as any).teamLeaderRef?.name ?? r.teamLeaderId ?? null,
    teamLeaderPhone: (rider as any).teamLeaderRef?.phone ?? null,
    planStartDate: r.planStartDate ? new Date(r.planStartDate as Date).toISOString() : null,
    planEndDate: r.planEndDate ? new Date(r.planEndDate as Date).toISOString() : null,
    pickupPhotoFront: r.pickupPhotoFront ?? null,
    pickupPhotoBack: r.pickupPhotoBack ?? null,
    pickupPhotoLeft: r.pickupPhotoLeft ?? null,
    pickupPhotoRight: r.pickupPhotoRight ?? null,
    pickupPhotoWithVehicle: r.pickupPhotoWithVehicle ?? null,

    locationGranted: r.locationGranted ?? false,
    cameraGranted: r.cameraGranted ?? false,
    contactsGranted: r.contactsGranted ?? false,
    phoneGranted: r.phoneGranted ?? false,
    batteryGranted: r.batteryGranted ?? false,
    callLogsGranted: r.callLogsGranted ?? false,
    micGranted: r.micGranted ?? false,
    deviceAdminGranted: r.deviceAdminGranted ?? false,
    displayOverlayGranted: r.displayOverlayGranted ?? false,

    // --- Rental Return fields ---
    returnPending: r.vehicleReturns?.some((v: any) => v.status === 'SUBMITTED') ?? false,
    ...(() => {
      const pendingReturn = r.vehicleReturns?.find((v: any) => v.status === 'SUBMITTED');
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
