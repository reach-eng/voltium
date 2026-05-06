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
import { maskAadhaar, maskPan } from './pii';

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

  return {
    ...rest,
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
    guarantorPhone: guarantor?.phone ?? null,
    guarantorAadhaarFront: guarantor?.aadhaarFront ?? null,
    guarantorAadhaarBack: guarantor?.aadhaarBack ?? null,
    guarantorPan: guarantor?.pan ?? null,
    guarantorVideo: guarantor?.video ?? null,
    guarantorSignature: guarantor?.signature ?? null,
    guarantorFatherName: (guarantor as any)?.fatherName ?? null,
    guarantorMotherName: (guarantor as any)?.motherName ?? null,

    // --- Plan & Status fields (Explicitly mapped to prevent loss) ---
    currentPlan: (rider as any).currentPlan ?? null,
    currentPlanPrice: (rider as any).currentPlanPrice ?? null,
    planStatus: (rider as any).planStatus ?? 'NONE',
    planStartDate: (rider as any).planStartDate ? new Date((rider as any).planStartDate).toISOString() : null,
    planEndDate: (rider as any).planEndDate ? new Date((rider as any).planEndDate).toISOString() : null,
    pickupPhoto: (rider as any).pickupPhoto ?? null,
    returnPending: rider.vehicleReturns?.some((v) => v.status === 'PENDING') ?? false,
  };
}

/**
 * For routes that include a partial set of relations (e.g. only kycProfile).
 */
export function flattenRiderPartial(rider: RiderPartial & Record<string, unknown>) {
  const result: Record<string, unknown> = {
    ...rider,
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
    result.aadhaarNumber = maskAadhaar(kyc.aadhaarNumber as string ?? null);
    result.panCard = kyc.panCard ?? null;
    result.panNumber = maskPan(kyc.panNumber as string ?? null);
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
    result.guarantorPhone = g.phone ?? null;
    result.guarantorFatherName = (g as any).fatherName ?? null;
    result.guarantorMotherName = (g as any).motherName ?? null;
  }

  // Explicitly map Plan fields
  result.currentPlan = (rider as any).currentPlan ?? (result.currentPlan || null);
  result.planStatus = (rider as any).planStatus ?? (result.planStatus || 'NONE');
  result.pickupPhoto = (rider as any).pickupPhoto ?? (result.pickupPhoto || null);

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
