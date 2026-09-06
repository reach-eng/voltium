/**
 * KYC module - Repository.
 *
 * Data access for KYC submissions, reviews, and document metadata.
 * All status transitions are validated against the KYC state machine.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { validateKycTransition, KycStateError } from './kyc-state-machine';
import type { KycStatus } from './kyc.types';
import { encryptPii, decryptPii } from '@/lib/pii-crypto';
import { invalidateRiderCache } from '@/lib/server-cache';
import { logKycDocumentView } from '@/lib/security-events';
import { LIFECYCLE_RANK } from '@/lib/lifecycle-ranks';
import type { RiderLifecycleStatus } from '@/server/modules/riders/rider-lifecycle.service';

/**
 * Lifecycle stages strictly lower in rank than KYC_APPROVED (ranks 0..3:
 * NEW, PHONE_VERIFIED, PROFILE_SUBMITTED, KYC_SUBMITTED).
 * F-06: Only riders currently at these earlier stages are promoted to
 * KYC_APPROVED on approval. Higher-ranked riders (ranks 4..14) retain
 * their current status without being demoted backward.
 */
export const LOWER_THAN_KYC_APPROVED: RiderLifecycleStatus[] = (
  Object.keys(LIFECYCLE_RANK) as RiderLifecycleStatus[]
).filter((status) => LIFECYCLE_RANK[status] < LIFECYCLE_RANK.KYC_APPROVED);

/**
 * Lifecycle stages strictly lower in rank than ACTIVE (ranks 0..10:
 * NEW, PHONE_VERIFIED, PROFILE_SUBMITTED, KYC_SUBMITTED, KYC_APPROVED,
 * GUARANTOR_SUBMITTED, GUARANTOR_APPROVED, DEPOSIT_PENDING, DEPOSIT_APPROVED,
 * PLAN_SELECTED, PICKUP_SCHEDULED).
 *
 * F-12: Only riders currently in pre-active onboarding stages are suspended on KYC rejection.
 * ACTIVE riders (rank 11), RETURN_PENDING (rank 13), and CLOSED (rank 14) riders
 * must NEVER be unconditionally moved to SUSPENDED via KYC rejection.
 */
export const PRE_ACTIVE_STAGES: RiderLifecycleStatus[] = (
  Object.keys(LIFECYCLE_RANK) as RiderLifecycleStatus[]
).filter((status) => LIFECYCLE_RANK[status] < LIFECYCLE_RANK.ACTIVE);

function encryptKycData(data: Record<string, unknown> | null) {
  if (!data) return data;
  const result = { ...data };
  if (result.aadhaarNumber !== undefined) result.aadhaarNumber = encryptPii(String(result.aadhaarNumber));
  if (result.panNumber !== undefined) result.panNumber = encryptPii(String(result.panNumber));
  if (result.accountNumber !== undefined) result.accountNumber = encryptPii(String(result.accountNumber));
  if (result.ifscCode !== undefined) result.ifscCode = encryptPii(String(result.ifscCode));
  return result;
}

function decryptKycData<T>(data: T): T {
  if (!data) return data;
  const result = { ...(data as Record<string, unknown>) };
  if (result.aadhaarNumber !== undefined) result.aadhaarNumber = decryptPii(String(result.aadhaarNumber));
  if (result.panNumber !== undefined) result.panNumber = decryptPii(String(result.panNumber));
  if (result.accountNumber !== undefined) result.accountNumber = decryptPii(String(result.accountNumber));
  if (result.ifscCode !== undefined) result.ifscCode = decryptPii(String(result.ifscCode));
  return result as T;
}

export const kycRepository = {
  async findByRiderId(riderDbId: string) {
    const kyc = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
    });
    return decryptKycData(kyc);
  },

  /**
   * Admin-context variant of findByRiderId. Fires the security-event
   * logger (logKycDocumentView) so every admin document access is
   * recorded in the audit log (SOC2 requirement).
   *
   * Use this from admin routes that show KYC documents to admins.
   * Use the plain findByRiderId for the rider's own self-service path.
   */
  async findByRiderIdForAdmin(riderDbId: string, adminContext: { adminId: string }) {
    const kyc = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
    });

    // Fire-and-forget audit log. Don't block the response on the write.
    if (kyc) {
      void logKycDocumentView({
        adminId: adminContext.adminId,
        riderId: riderDbId,
        documentType: 'full_profile',
      });
    }

    return decryptKycData(kyc);
  },

  async findMany(args: Prisma.KycProfileFindManyArgs) {
    const records = await db.kycProfile.findMany(args);
    return records.map(decryptKycData);
  },

  async count(args: Prisma.KycProfileCountArgs) {
    return db.kycProfile.count(args);
  },

  /**
   * Saves KYC data without changing status — used for progressive uploads.
   * Does NOT trigger state machine validation since status is preserved.
   */
  async savePartialKyc(riderDbId: string, data: Record<string, unknown>) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true, editableFields: true },
    });

    // Preserve current status (don't transition to SUBMITTED)
    const currentStatus = existing?.status || 'DRAFT';

    // P1: an APPROVED profile is locked (editableFields = []). The old code
    // let an approved rider overwrite Aadhaar/PAN via partial saves,
    // defeating the approval lock. Rejected/info-required profiles honor
    // the reviewer-supplied editableFields allowlist.
    if (currentStatus === 'APPROVED') {
      throw new KycStateError(
        'KYC is approved and locked. Ask an admin to request changes first.',
        'APPROVED',
        'APPROVED'
      );
    }
    let writable = { ...data };
    const allowlist = existing?.editableFields;
    if (
      (currentStatus === 'REJECTED' || currentStatus === 'INFO_REQUIRED') &&
      allowlist &&
      allowlist.length > 0
    ) {
      const allowed = new Set(allowlist);
      writable = Object.fromEntries(Object.entries(writable).filter(([k]) => allowed.has(k)));
    }

    const encryptedData = encryptKycData(writable);

    const kyc = await db.kycProfile.upsert({
      where: { riderId: riderDbId },
      create: {
        ...(encryptedData as unknown as Prisma.KycProfileUncheckedCreateInput),
        riderId: riderDbId,
        status: currentStatus,
      },
      update: {
        ...(encryptedData as unknown as Prisma.KycProfileUncheckedUpdateInput),
        // Don't change status — let submitKyc handle the transition
      },
    });
    invalidateRiderCache(riderDbId);
    return decryptKycData(kyc);
  },

  async submitKyc(riderDbId: string, data: Record<string, unknown>) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'SUBMITTED');

    const encryptedData = encryptKycData(data);

    return db.$transaction(async (tx) => {
      const kyc = await tx.kycProfile.upsert({
        where: { riderId: riderDbId },
        create: {
          ...(encryptedData as unknown as Prisma.KycProfileUncheckedCreateInput),
          riderId: riderDbId,
          status: 'SUBMITTED',
        },
        update: {
          ...(encryptedData as unknown as Prisma.KycProfileUncheckedUpdateInput),
          status: 'SUBMITTED',
        },
      });

      await tx.rider.updateMany({
        where: {
          id: riderDbId,
          lifecycleStatus: { in: ['NEW', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED'] },
        },
        data: { lifecycleStatus: 'KYC_SUBMITTED', kycDoneAt: new Date() },
      });

      invalidateRiderCache(riderDbId);
      return decryptKycData(kyc);
    });
  },

  async approveKyc(riderDbId: string, reviewerId: string) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'APPROVED');

    return db.$transaction(async (tx) => {
      // PR-KYC-CORRECTION: promote the rider's held correction values into
      // the real Rider/KycProfile columns and clear the blob + allowlist
      // atomically with the APPROVED status landing.
      await applyPendingCorrections(tx, riderDbId);
      const kyc = await tx.kycProfile.update({
        where: { riderId: riderDbId },
        // AUDIT-RECON 2026-09-02 batch 6 P0-3: lock the profile post-
        // approval by setting editableFields = []. The rider-side
        // check at flutter/lib/features/kyc/presentation/screens/
        // user_onboarding_screen.dart:988-995 is
        //   kycEditableFields == null || isEmpty
        //   ? true   // editable
        //   : contains(fieldName)
        // A null/empty editableFields means "no restriction" — the
        // rider can edit every field. The reject path (line ~209)
        // sets editableFields to the reviewer-supplied list, but
        // the APPROVE path was leaving it untouched, so an approved
        // rider could re-submit their name / DOB / Aadhaar number
        // after approval. Lock everything on approval so a future
        // re-submit requires an admin REJECT first.
        //
        // NET-005 (audit batch 20, 2026-09-02): also set expiresAt
        // so the kyc-expiry.job.ts worker can later transition this
        // row from APPROVED to EXPIRED when the 365-day window
        // passes. The window matches the AuditLog retention for
        // kyc.* actions (web/src/lib/audit-log.ts:4-10) so the
        // expiry horizon and the audit trail horizon are aligned.
        data: {
          status: 'APPROVED',
          editableFields: [],
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          pendingCorrections: Prisma.DbNull,
        },
      });
      await tx.rider.update({
        where: { id: riderDbId },
        data: { kycDoneAt: new Date() },
      });
      // F-06: Only advance the rider's lifecycleStatus to KYC_APPROVED if they are
      // currently at an earlier stage (ranks 0..3: NEW, PHONE_VERIFIED, PROFILE_SUBMITTED, KYC_SUBMITTED).
      // Higher-ranked riders (ranks 4..14: GUARANTOR_*, DEPOSIT_*, PLAN_SELECTED, PICKUP_SCHEDULED,
      // ACTIVE, etc.) must NEVER be demoted backward to rank 4, preserving downstream onboarding progress.
      await tx.rider.updateMany({
        where: { 
          id: riderDbId, 
          lifecycleStatus: { in: LOWER_THAN_KYC_APPROVED },
        },
        data: { lifecycleStatus: 'KYC_APPROVED' },
      });

      invalidateRiderCache(riderDbId);

      // BLOCKER 2.7: notification is dispatched by the outbox worker
      // (kyc.use-cases.ts emits NOTIFICATION_SEND inside the same
      // transaction). The repository no longer fires a duplicate
      // notificationService.notifyKycStatusChange call.
      //
      // The use-case's emit() is committed atomically with the KYC
      // approval, and notificationDispatchJob (Phase 1.4) handles
      // the actual delivery with retry/backoff.

      return kyc;
    });
  },

  async rejectKyc(riderDbId: string, reviewerId: string, reason: string, editableFields: string[] = []) {
    // Read current status to validate transition
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'REJECTED');

    return db.$transaction(async (tx) => {
      const kyc = await tx.kycProfile.update({
        where: { riderId: riderDbId },
        data: { status: 'REJECTED', rejectionReason: reason, editableFields },
      });
      // F-12: Only riders currently in pre-active onboarding stages (ranks 0..10)
      // are moved to SUSPENDED upon KYC rejection. ACTIVE riders (rank 11),
      // RETURN_PENDING (rank 13), and CLOSED (rank 14) riders retain their
      // lifecycleStatus, preventing abrupt fleet lockout or corrupting terminal/return flows.
      await tx.rider.updateMany({
        where: {
          id: riderDbId,
          lifecycleStatus: { in: PRE_ACTIVE_STAGES },
        },
        data: { lifecycleStatus: 'SUSPENDED' },
      });

      invalidateRiderCache(riderDbId);

      // BLOCKER 2.7: notification is dispatched by the outbox worker.
      // See the comment on approveKyc above.

      return kyc;
    });
  },

  async requestInfo(riderDbId: string, reviewerId: string, infoRequest: string) {
    const existing = await db.kycProfile.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
    validateKycTransition(currentStatus, 'INFO_REQUIRED');

    return db.kycProfile.update({
      where: { riderId: riderDbId },
      data: {
        status: 'INFO_REQUIRED',
        rejectionReason: infoRequest,
      },
    }).then((kyc) => {
      invalidateRiderCache(riderDbId);
      return kyc;
    });
  },
};

// PR-KYC-CORRECTION: keys that live on the Rider table (vs the KycProfile
// table) and that may be held as a pending correction. The KYC
// repository.applyPendingCorrections helper uses these sets to decide
// which table to write each held value into.
//
// Kept in sync with the editableFields allowlist in
// prisma/migrations/20260906000000_kyc_editable_fields_full_taxonomy/
// migration.sql (the 16-key taxonomy). The taxonomy change was a
// separate audit-driven work; the routing here is what the WIP
// PR-KYC-CORRECTION added on 2026-09-06.
const RIDER_LEVEL_CORRECTION_KEYS = new Set<string>([
  'fullName',
  'fatherName',
  'motherName',
  'dob',
  'currentAddress',
  'emergencyContact',
]);
const KYC_LEVEL_CORRECTION_KEYS = new Set<string>([
  'aadhaarFront',
  'aadhaarBack',
  'panCard',
  'bankName',
  'accountNumber',
  'ifscCode',
  'profilePhoto',
  'signature',
  'name',
  'email',
]);

// The app's Prisma client is extended at runtime, so `$transaction` hands
// its callback a DynamicClientExtensionThis whose findUnique wraps the
// select parameter in Prisma's `Exact<...>` strict-type helper. A
// structural type with `unknown` for the select argument is not
// assignable to `Exact<KycProfileSelect<...> | null | undefined>`. Use
// `any` for the args that the helper does not statically inspect; the
// body only reads `pendingCorrections` and does the
// `data: Record<string, unknown>` write, both of which are
// `any`-compatible at the call site.
type KycCorrectionTx = {
  kycProfile: {
    findUnique: (args: any) => Promise<{ pendingCorrections?: unknown } | null>;
    update: (args: any) => Promise<unknown>;
  };
  rider: {
    update: (args: any) => Promise<unknown>;
  };
};

export async function applyPendingCorrections(
  tx: KycCorrectionTx,
  riderDbId: string,
): Promise<void> {
  const profile = await tx.kycProfile.findUnique({
    where: { riderId: riderDbId },
    select: { pendingCorrections: true },
  });
  const pending = profile?.pendingCorrections as
    | { values?: Record<string, string> }
    | null;
  const values = pending?.values ?? {};

  const riderUpdate: Record<string, string> = {};
  const kycUpdate: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    // Unknown/garbage keys are ignored rather than failing the approval —
    // the allowlist CHECK already bounds what could have been stored.
    if (typeof value !== 'string') continue;
    if (RIDER_LEVEL_CORRECTION_KEYS.has(key)) riderUpdate[key] = value;
    else if (KYC_LEVEL_CORRECTION_KEYS.has(key)) kycUpdate[key] = value;
  }

  if (Object.keys(riderUpdate).length > 0) {
    await tx.rider.update({ where: { id: riderDbId }, data: riderUpdate });
  }
  if (Object.keys(kycUpdate).length > 0) {
    await tx.kycProfile.update({ where: { riderId: riderDbId }, data: kycUpdate });
  }

  // Promoted (or nothing held) — clear the blob and lock the allowlist so
  // a post-approval resubmit requires a fresh REJECT/INFO_REQUIRED first.
  await tx.kycProfile.update({
    where: { riderId: riderDbId },
    data: {
      pendingCorrections: Prisma.DbNull,
      editableFields: [],
    },
  });
  invalidateRiderCache(riderDbId);
}
