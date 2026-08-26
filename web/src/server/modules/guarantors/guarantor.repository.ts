/**
 * Guarantors module - Repository.
 *
 * Data access for guarantor submissions, reviews, and replacement records.
 * All status transitions are validated against the guarantor state machine.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { validateGuarantorTransition, GuarantorStateError } from './guarantor-state-machine';
import type { GuarantorStatus } from './guarantor.types';
import { encryptPii, decryptPii } from '@/lib/pii-crypto';
import { invalidateRiderCache } from '@/lib/server-cache';

function encryptGuarantorData(data: Record<string, unknown> | null) {
  if (!data) return data;
  const result = { ...data };
  if (result.pan !== undefined) result.pan = encryptPii(String(result.pan));
  return result;
}

function decryptGuarantorData<T>(data: T): T {
  if (!data) return data;
  const result = { ...(data as Record<string, unknown>) };
  if (result.pan !== undefined) result.pan = decryptPii(String(result.pan));
  return result as T;
}

export const guarantorRepository = {
  async findByRiderId(riderDbId: string) {
    const guarantor = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
    });
    return decryptGuarantorData(guarantor);
  },

  async findMany(args: Prisma.GuarantorFindManyArgs) {
    const records = await db.guarantor.findMany(args);
    return records.map(decryptGuarantorData);
  },

  async count(args: Prisma.GuarantorCountArgs) {
    return db.guarantor.count(args);
  },

  async submitGuarantor(riderDbId: string, data: Record<string, unknown>) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'SUBMITTED');

    const encryptedData = encryptGuarantorData(data);

    return db.$transaction(async (tx) => {
      const guarantor = await tx.guarantor.upsert({
        where: { riderId: riderDbId },
        create: {
          ...(encryptedData as unknown as Prisma.GuarantorUncheckedCreateInput),
          riderId: riderDbId,
          status: 'SUBMITTED',
        },
        update: {
          ...(encryptedData as unknown as Prisma.GuarantorUncheckedUpdateInput),
          status: 'SUBMITTED',
        },
      });
      // PR-ONBOARDING-FLOW-2026-08-12 (active path): the active path
      // runs KYC + guarantor in parallel, so the rider can submit
      // the guarantor form while still in PROFILE_SUBMITTED, KYC_SUBMITTED,
      // or KYC_APPROVED (ranks 2, 3, 4). The previous guard
      // `lifecycleStatus: { in: ['PROFILE_SUBMITTED'] }` only bumped
      // rank-2 riders, leaving rank 3-4 riders stuck on the guarantor
      // form forever (lifecycle gate re-routes them back since their
      // rank never advances). Loosen the allowlist to ranks 2-4.
      await tx.rider.updateMany({
        where: {
          id: riderDbId,
          lifecycleStatus: {
            in: ['PROFILE_SUBMITTED', 'KYC_SUBMITTED', 'KYC_APPROVED'],
          },
        },
        data: { lifecycleStatus: 'GUARANTOR_SUBMITTED' },
      });
      invalidateRiderCache(riderDbId);
      return decryptGuarantorData(guarantor);
    });
  },

  async approveGuarantor(riderDbId: string, reviewerId: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'APPROVED');

    return db.$transaction(async (tx) => {
      const claimResult = await tx.guarantor.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        data: { status: 'APPROVED' },
      });
      if (claimResult.count === 0) {
        throw new GuarantorStateError(
          `Concurrent decision race: guarantor for rider ${riderDbId} is no longer in status "${currentStatus}"`,
          currentStatus,
          'APPROVED'
        );
      }
      const guarantor = await tx.guarantor.findUniqueOrThrow({ where: { riderId: riderDbId } });
      // PR-ONBOARDING-FLOW-2026-08-12 (active path): a rank-3/4 rider
      // who submitted the guarantor via the active path was bumped to
      // GUARANTOR_SUBMITTED at submission (see the parallel-KYC fix
      // above). Admin approval must now accept that source state too —
      // the previous `in: ['GUARANTOR_SUBMITTED']` guard would leave
      // such riders stuck.
      await tx.rider.updateMany({
        where: {
          id: riderDbId,
          lifecycleStatus: {
            in: [
              'GUARANTOR_SUBMITTED',
              // Race: admin approves KYC at the same time the rider
              // submits guarantor — KYC bump lands first, rider is
              // briefly at KYC_APPROVED when the approval transaction
              // runs. Without this, the lifecycle never advances.
              'KYC_APPROVED',
            ],
          },
        },
        data: { lifecycleStatus: 'GUARANTOR_APPROVED' },
      });
      invalidateRiderCache(riderDbId);
      // W7 / R-7f: audit parity with KYC decisions.
      createAuditLog({
        actorId: reviewerId,
        action: 'guarantor.approve',
        entity: 'guarantor',
        entityId: riderDbId,
        details: { riderId: riderDbId },
      }).catch(() => {});
      return decryptGuarantorData(guarantor);
    });
  },

  async rejectGuarantor(riderDbId: string, reviewerId: string, reason: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'REJECTED');

    return db.$transaction(async (tx) => {
      const claimResult = await tx.guarantor.updateMany({
        where: { riderId: riderDbId, status: currentStatus },
        // W7 / R-7f: persist the review reason alongside the decision —
        // previously the reason argument was accepted and discarded.
        data: { status: 'REJECTED', rejectionReason: reason ?? null },
      });
      if (claimResult.count === 0) {
        throw new GuarantorStateError(
          `Concurrent decision race: guarantor for rider ${riderDbId} is no longer in status "${currentStatus}"`,
          currentStatus,
          'REJECTED'
        );
      }
      const guarantor = await tx.guarantor.findUniqueOrThrow({ where: { riderId: riderDbId } });
      // PR-ONBOARDING-2026-08-11 (audit 2.21): only suspend an ACTIVE rider
      // on a fresh reject. Re-rejecting an already-REJECTED row, or
      // rejecting a rider who is already CLOSED/SUSPENDED, must not
      // silently flip their state. Use a guarded updateMany with a
      // count check — if 0 rows are affected, the rider is in a
      // non-suspendable state and the guarantor rejection still
      // proceeds (the guarantor record status is the source of truth
      // for the rejection).
      const suspendResult = await tx.rider.updateMany({
        where: {
          id: riderDbId,
          // Only suspend riders in a pre-suspension lifecycle. SUSPENDED
          // and CLOSED are excluded so re-rejects are silent.
          lifecycleStatus: { notIn: ['SUSPENDED', 'CLOSED'] },
        },
        data: { lifecycleStatus: 'SUSPENDED' },
      });
      if (suspendResult.count === 0) {
        // The rider is in a non-suspendable state; this is informational
        // (e.g. they are ACTIVE on a rental but the rider row hasn't been
        // updated to SUSPENDED — actually they would be, so this branch
        // is mostly for race conditions with concurrent updates).
        // We do not throw — the guarantor rejection is still valid.
      }
      invalidateRiderCache(riderDbId);
      // W7 / R-7f: audit parity with KYC decisions (reason persisted above).
      createAuditLog({
        actorId: reviewerId,
        action: 'guarantor.reject',
        entity: 'guarantor',
        entityId: riderDbId,
        details: { riderId: riderDbId, rejectionReason: reason ?? null },
      }).catch(() => {});
      return decryptGuarantorData(guarantor);
    });
  },

  async requestInfo(riderDbId: string, reviewerId: string, infoRequest: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'INFO_REQUIRED');

    const guarantor = await db.guarantor.update({
      where: { riderId: riderDbId },
      data: {
        status: 'INFO_REQUIRED',
      },
    });
    invalidateRiderCache(riderDbId);
    return decryptGuarantorData(guarantor);
  },

  async autoVerifyTestGuarantor(riderDbId: string) {
    const guarantor = await db.guarantor.update({
      where: { riderId: riderDbId },
      data: { status: 'APPROVED' },
    });
    invalidateRiderCache(riderDbId);
    return decryptGuarantorData(guarantor);
  },

  async replaceGuarantor(riderDbId: string) {
    const existing = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: GuarantorStatus = (existing?.status as GuarantorStatus) || 'DRAFT';
    validateGuarantorTransition(currentStatus, 'REPLACED');

    // PR-ONBOARDING-2026-08-11 (audit 2.20): wrap the guarantor update and
    // the rider lifecycle reset in a single transaction. After
    // rejection, the rider is at SUSPENDED. Replacing the guarantor
    // re-arms the onboarding — without a lifecycle bump, the rider is
    // stuck at SUSPENDED and cannot re-submit. Move the rider back to
    // GUARANTOR_SUBMITTED (the state they will enter again when they
    // submit the new guarantor data).
    return db.$transaction(async (tx) => {
      const guarantor = await tx.guarantor.update({
        where: { riderId: riderDbId },
        data: { status: 'REPLACED' },
      });
      await tx.rider.updateMany({
        where: {
          id: riderDbId,
          // Only re-arm suspended/closed riders, never ACTIVE.
          // ACTIVE riders who replace a guarantor are doing it from a
          // live rental — leave the lifecycle alone so the rental
          // continues uninterrupted.
          lifecycleStatus: { in: ['SUSPENDED', 'CLOSED'] },
        },
        data: { lifecycleStatus: 'GUARANTOR_SUBMITTED' },
      });
      invalidateRiderCache(riderDbId);
      return decryptGuarantorData(guarantor);
    });
  },
};
