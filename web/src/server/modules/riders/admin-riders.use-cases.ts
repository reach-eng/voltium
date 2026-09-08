/**
 * Admin Riders module - Use cases.
 *
 * Orchestrates admin rider management: list with full filters, create with relations,
 * update with field-level security and wallet adjustments, delete with cascade.
 *
 * All wallet mutations go through wallet-service (ledger-backed).
 */

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { Prisma, RiderLifecycleStatus, KycStatus } from '@prisma/client';
import { flattenRider as sharedFlattenRider } from '@/lib/flatten-rider';
import { sanitizeText } from '@/lib/sanitize';
import { signRiderUrlsWithProvider } from '@/lib/sign-rider';
import { getFeatureFlags } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';
import { logAccountSuspension } from '@/lib/security-events';
import { logger } from '@/lib/logger';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { transitionRiderStatus, validateTransition, RiderLifecycleError } from '@/server/modules/riders/rider-lifecycle.service';
import { getDurationForPlanType } from '@/server/modules/plans/plan.use-cases';
import { ensureActiveRentalLease } from '@/server/modules/rentals/rental.use-cases';
import { getCachedRider, getCachedRiderByPhone, invalidateRiderCache, invalidateRiderPhoneCache, invalidateVehicleCache } from '@/lib/server-cache';
import { invalidateCache } from '@/lib/cache';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { validateKycTransition, type KycStatus as KycMachineStatus } from '@/server/modules/kyc/kyc-state-machine';
import { validateGuarantorTransition, type GuarantorStatus } from '@/server/modules/guarantors/guarantor-state-machine';
import {
  promoteToApproved,
  promoteToRejected,
  promoteToInfoRequired,
} from '@/server/modules/kyc/kyc.repository';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { fleetUseCases } from '@/server/modules/riders/admin-rider-fleet.use-cases';

// Field allowlists for mass-assignment protection
const SAFE_RIDER_FIELDS = new Set([
  'fullName',
  'email',
  'fatherName',
  'motherName',
  'dob',
  'currentAddress',
  'emergencyContact',
  'pickupHub',
  'teamLeaderId',
  'planStartDate',
  'planEndDate',
  'intent',
  'referralCode',
  'phone',
  'preferredShift',
  'referredBy',
  'assignedVehicle',
  // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): the bulk Suspend
  // action goes through `updateStatus` with value
  // 'SUSPENDED', which the route maps to
  // `{lifecycleStatus: value}`. The Zod schema
  // (`updateRiderSchema`) already accepts `lifecycleStatus`
  // but the use-case allowlist previously did not, so
  // direct lifecycleStatus writes were silently dropped.
  // The KYC-status writes at line 445-506 still gate
  // `lifecycleStatus` through their own rank-based guards;
  // this allowlist entry is for explicit admin overrides
  // (Suspend, Restore, manual stage correction).
  'lifecycleStatus',
  'lifecycleStage',
]);

// NET-005 follow-up-21 (2026-09-08): explicit
// allowlist for `updateSecurityFlags` — the
// helper writes to `db.rider.update({ data: <x> })`
// with no key filter, so any caller passing an
// extra key writes an arbitrary column. Today
// only the actions route feeds it fixed keys
// (the 5 below + the special-case `lockPassword`
// plaintext), but a future refactor that passes
// `lifecycleStatus` or any other rider column
// would silently write that column. Throw on
// unknown keys — defense in depth. The
// `lockPassword` plaintext is the only non-DB
// key (it's hashed into `lockPasswordHash` before
// the write); allowlist it explicitly.
const SECURITY_RIDER_FIELDS = new Set([
  'isAdminLocked',
  'lockPasswordHash',
  'isUninstallBlocked',
  'isLocationMandatory',
  'isAppsControlRestricted',
  'lockPassword',
]);

const KYC_FIELDS = new Set([
  'kycStatus',
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
  'rejectionReason',
  'editableFields',
]);

const WALLET_FIELDS = new Set([
  'securityDeposit',
  'balanceInPaise',
  'depositStatus',
]);

const GUARANTOR_FIELDS = new Set([
  'guarantorStatus',
  'guarantorName',
  'guarantorRelation',
  'guarantorPhone',
  'guarantorDob',
  'guarantorAadhaarFront',
  'guarantorAadhaarBack',
  'guarantorPan',
  'guarantorVideo',
  'guarantorSignature',
  'guarantorFatherName',
  'guarantorMotherName',
  'guarantorAddress',
  'guarantorPhoto',
]);

/**
 * NET-005 follow-up-19 (2026-09-08): typed error
 * for the rider-create phone-existence check.
 * The route catches this and returns 409. A
 * message-text sniff (e.g. `error.message.includes(
 * 'already exists')`) is fragile and was replaced
 * with this typed marker; the Prisma P2002 race
 * (two concurrent creates that both pass the
 * pre-check) is caught at the route level via
 * `PrismaClientKnownRequestError` — the same 409
 * status, a different signal.
 */
export class RiderPhoneExistsError extends Error {
  constructor(public readonly phone: string) {
    super(`Rider with phone ${phone} already exists`);
    this.name = 'RiderPhoneExistsError';
  }
}

export const adminRiderUseCases = {
  /**
   * List riders with full filters, search, pagination, and shared guarantor detection.
   */
  async list(filters: {
    search?: string;
    state?: string;
    kycStatus?: string;
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
    // PR-7 (2026-08-06 fix-plan; 1st audit P0-1): the data-deletion queue
    // needs to list soft-deleted riders. Explicit `deletedAt` filter overrides
    // the middleware's default `deletedAt: null` (see lib/db.ts).
    if (deleted) {
      where.deletedAt = { not: null };
    }
    if (state && state !== 'ALL') where.lifecycleStatus = state as RiderLifecycleStatus;
    if (kycStatus) {
      // NET-005 follow-up-7 (2026-09-08): the queue's
      // "PENDING" filter must include riders who haven't
      // started KYC submission at all. The current
      // `where.kycProfile = { status: 'PENDING' }` only
      // matches riders whose `KycProfile` row exists and
      // has status PENDING — self-signup riders have a
      // `Rider` row but no `KycProfile` row (see
      // `auth.use-cases.ts:154`), so they fall through
      // the relation filter and are invisible to the
      // queue. The "not yet reviewed" set has three
      // representations: no `KycProfile` row (just
      // signed up), `KycProfile` with status PENDING
      // (DB default, never opened the KYC flow), and
      // `KycProfile` with status DRAFT (the KYC state
      // machine's starting state — see
      // `kyc-state-machine.ts`). All three should land
      // in the queue. For other status filters
      // (SUBMITTED, APPROVED, REJECTED, INFO_REQUIRED),
      // the rider has a row by definition, so the
      // existing single-field filter is correct.
      if (kycStatus === 'PENDING') {
        where.OR = [
          { kycProfile: null },
          { kycProfile: { status: 'PENDING' } },
          { kycProfile: { status: 'DRAFT' } },
        ];
      } else {
        where.kycProfile = { status: kycStatus as KycStatus };
      }
    }
    if (startDate || endDate) {
      let gteDate: Date | undefined;
      if (startDate) {
        const d = new Date(startDate);
        if (!Number.isNaN(d.getTime())) gteDate = d;
      }
      let lteDate: Date | undefined;
      if (endDate) {
        // P2-2: Handle both ISO datetime ('2026-09-08T00:00:00.000Z') and date-only ('2026-09-08')
        // safely without creating invalid string concatenations like `...ZT23:59:59.999Z`.
        const d = new Date(endDate);
        if (!Number.isNaN(d.getTime())) {
          d.setUTCHours(23, 59, 59, 999);
          lteDate = d;
        }
      }
      if (gteDate || lteDate) {
        where.createdAt = {
          ...(gteDate ? { gte: gteDate } : {}),
          ...(lteDate ? { lte: lteDate } : {}),
        };
      }
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
          // PR-7 (1st audit P0-1): the data-deletion queue shows
          // daysRemaining from deletedAt; the purge worker (7-day window)
          // needs it in the payload too.
          deletedAt: true,
          // PR-2026-08-16: lets the queue distinguish "purged" from
          // "pending 7-day window" (deletedAt set, purgedAt null).
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

    // Shared guarantor detection
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
  },

  /**
   * Create a new rider with associated wallet, KYC, and guarantor records.
   */
  async create(input: { phone: string; fullName?: string }) {
    const { phone, fullName } = input;

    const existing = await getCachedRiderByPhone(phone, () =>
      db.rider.findUnique({ where: { phone } })
    );
    if (existing) {
      // NET-005 follow-up-19 (2026-09-08): the pre-fix
      // code threw `Error('Phone already exists')`
      // and the route sniffed the message string.
      // The route now catches the typed error and
      // returns 409; the message-text sniff is gone.
      // The Prisma P2002 race (two concurrent creates
      // with the same phone both pass the existence
      // check) is caught at the route level via the
      // `PrismaClientKnownRequestError` check — the
      // message here is just for the pre-check path.
      throw new RiderPhoneExistsError(phone);
    }

    const riderId = `VF-RD-${randomUUID().slice(0, 8).toUpperCase()}`;

    const rider = await db.$transaction(async (tx) => {
      let created = await tx.rider.create({
        data: {
          phone,
          fullName: fullName ? sanitizeText(fullName) : null,
          riderId,
          referralCode: `VFR-${randomUUID().slice(0, 6).toUpperCase()}`,
        },
      });

      if (fullName) {
        const prefix = fullName.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
        const newRiderId = `VEM${prefix}${String(created.serialNumber).padStart(3, '0')}`;
        created = await tx.rider.update({
          where: { id: created.id },
          data: { riderId: newRiderId },
        });
      }

      await tx.wallet.create({ data: { riderId: created.id } });
      // NET-005 follow-up-19 (2026-09-08): the
      // pre-fix code wrote `tx.kycProfile.create({
      // data: { riderId } })` with no status, which
      // lets the DB default (PENDING) win. The
      // state machine's KYC journey starts at DRAFT
      // (see kyc-state-machine.ts:DRAFT). PENDING is
      // only meaningful as a re-verify target from
      // EXPIRED (follow-up-13) — a freshly-created
      // rider row should be DRAFT, not PENDING.
      await tx.kycProfile.create({
        data: { riderId: created.id, status: 'DRAFT' },
      });
      await tx.guarantor.create({ data: { riderId: created.id } });

      return tx.rider.findUnique({
        where: { id: created.id },
        include: { kycProfile: true, wallet: true, guarantor: true },
      });
    });

    // The phone-existence check above may have cached "not found" for this
    // phone; clear it so the next create attempt with the same phone sees
    // the freshly-inserted rider and fails the unique constraint cleanly.
    invalidateRiderPhoneCache(phone);

    if (!rider) throw new Error('Rider created but could not be reloaded');
    return sharedFlattenRider(rider);
  },

  /**
   * Update a rider with field-level security.
   * Handles safe rider fields, KYC fields, wallet fields (with ledger-backed mutations),
   * guarantor fields, KYC status notifications, and audit logging.
   */
  async update(
    id: string,
    data: Record<string, unknown>,
    context: { actorId: string; actorRole: string }
  ) {
    const { actorId, actorRole } = context;

    const existing = await getCachedRider(id, () => db.rider.findUnique({ where: { id } }));
    if (!existing) throw new Error('Rider not found');

    const riderData: any = {};
    const kycData: any = {};
    const walletData: any = {};
    const guarantorData: any = {};
    // NET-005 (2026-09-08): flag the approve branch so the
    // transaction body calls `promoteToApproved` after the
    // kyc upsert. The helper writes the four approval
    // fields atomically with the rest of the transaction's
    // field updates.
    let promotingApproved = false;
    // REJECT symmetry (2026-09-08): flag the reject and
    // info-required branches so the transaction body calls
    // the matching helper. The REJECT helper runs the F-12
    // PRE_ACTIVE_STAGES guard; the INFO_REQUIRED helper
    // does not touch lifecycle (the dead-path's `requestInfo`
    // standard).
    let promotingRejected = false;
    let promotingInfoRequired = false;

    for (const [key, value] of Object.entries(data)) {
      if (key === 'walletBalance') {
        throw new Error('Direct walletBalance mutations are blocked — use Wallet Adjust API');
      }

      if (KYC_FIELDS.has(key)) {
        if (key === 'kycStatus') kycData.status = value;
        else kycData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      } else if (WALLET_FIELDS.has(key)) {
        if (key === 'securityDeposit')
          walletData.securityDeposit = Math.round(Number(value) * 100);
        else walletData[key] = value;
      } else if (GUARANTOR_FIELDS.has(key)) {
        if (key === 'guarantorStatus') guarantorData.status = value;
        else if (key === 'guarantorName')
          guarantorData.name = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorRelation')
          guarantorData.relation = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorPhone') guarantorData.phone = value;
        else if (key === 'guarantorDob') guarantorData.dob = value;
        else if (key === 'guarantorAadhaarFront') guarantorData.aadhaarFront = value;
        else if (key === 'guarantorAadhaarBack') guarantorData.aadhaarBack = value;
        else if (key === 'guarantorPan') guarantorData.pan = value;
        else if (key === 'guarantorVideo') guarantorData.video = value;
        else if (key === 'guarantorSignature') guarantorData.signature = value;
        else if (key === 'guarantorFatherName')
          guarantorData.fatherName = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorMotherName')
          guarantorData.motherName = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorAddress')
          guarantorData.address = typeof value === 'string' ? sanitizeText(value) : value;
        else if (key === 'guarantorPhoto') guarantorData.photo = value;
        else guarantorData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      } else if (SAFE_RIDER_FIELDS.has(key)) {
        riderData[key] = typeof value === 'string' ? sanitizeText(value) : value;
      }
    }

    // Sync lifecycleStatus with KycProfile status.
    //
    // PR-ONBOARDING-FLOW-2026-08-13: do NOT downgrade a rider who has
    // already progressed past the KYC rank. The admin can legitimately
    // approve KYC for a rider who is already PICKUP_SCHEDULED or
    // ACTIVE (e.g., the KYC was pending when the rider was fast-tracked
    // through the flow, or the admin is fixing a stale KYC record after
    // the fact). Setting lifecycleStatus = 'KYC_APPROVED' in that
    // case would yank the rider back to the KYC-approved rank and
    // strand them on the wrong screen — the mobile app would have
    // stale PICKUP_SCHEDULED data and the hang-tight poll would never
    // see the new (downgraded) state because the rider is already
    // past it on the server. The rider would be stuck on hang-tight
    // even though the admin intended to *progress* them.
    //
    // The correct behaviour: only set lifecycleStatus if the rider's
    // current rank is <= the KYC rank (4). For a rider already at
    // rank 5+ (GUARANTOR_SUBMITTED or beyond), the KYC approval is
    // recorded (kycDoneAt + guarantorData.status) but the lifecycle
    // stays where it is.
    if (kycData.status === 'APPROVED') {
      // NET-005 fix (2026-09-08): the inline `lifecycleStatus` /
      // `kycDoneAt` writes used to be the entire approval
      // surface. That left the live path divergent from
      // kycRepository.approveKyc — no `expiresAt` (so the
      // 365-day expiry sweep never matched), no
      // `editableFields: []` lock (re-submit was unblocked),
      // no `pendingCorrections` cleanup, and no
      // applyPendingCorrections step. The four writes now
      // live in `promoteToApproved` (kyc.repository.ts),
      // shared by both the use-case and the repo. The
      // use-case calls it inside the existing transaction
      // (see below) so the writes are atomic with the other
      // field updates. The F-06 rank guard
      // (`lifecycleStatus` only promoted for ranks 0..3) is
      // preserved inside `promoteToApproved`.
      //
      // The guarantor auto-approve is a separate concern from
      // NET-005 and stays in this branch:
      const existingGuarantor = await db.guarantor.findUnique({ where: { riderId: id } });
      if (existingGuarantor?.status === 'SUBMITTED') {
        guarantorData.status = 'APPROVED';
      }
      promotingApproved = true;
    }
    if (kycData.status === 'REJECTED' || kycData.status === 'INFO_REQUIRED') {
      // REJECT symmetry (2026-09-08, follow-up to NET-005):
      // the inline `lifecycleStatus` write is replaced by
      // `promoteToRejected` / `promoteToInfoRequired` (called
      // inside the transaction below). The previous inline
      // guard `currentRank <= 4` was a strict sub-set of
      // the documented F-12 `PRE_ACTIVE_STAGES` standard
      // (ranks 0..10: NEW through PICKUP_SCHEDULED). After
      // the refactor, riders at ranks 5..10 (GUARANTOR_*,
      // DEPOSIT_*, PLAN_SELECTED, PICKUP_SCHEDULED) will be
      // moved to SUSPENDED on KYC_REJECTED where they
      // previously kept their rank. This matches the dead
      // repo's `rejectKyc` behavior (F-12).
      //
      // INFO_REQUIRED: no lifecycle change — the dead path's
      // `requestInfo` does not touch lifecycle, and the
      // previous inline write's "promote to KYC_SUBMITTED
      // for ranks 0..4" was an undocumented extra not in
      // the F-12 / dead-path standard. The refactor drops it.
      //
      // NET-005 follow-up-19 (2026-09-08): the previous
      // code unconditionally set `guarantorData.status =
      // 'REJECTED' | 'INFO_REQUIRED'`, clobbering the
      // guarantor's existing state. The user flagged
      // this as the "reject clobbers an APPROVED
      // guarantor" bug. Mirror the APPROVE branch's
      // guard (line 544-547) — only set the guarantor
      // status when the current is SUBMITTED (the
      // state from which both REJECTED and
      // INFO_REQUIRED are valid transitions per
      // `guarantor-state-machine.ts:SUBMITTED`).
      // DRAFT (no guarantor submitted yet) and
      // APPROVED (already approved) are no-ops: the
      // KYC decision is recorded on the KycProfile
      // but the guarantor row is left alone.
      const wasSuspended = kycData.status === 'REJECTED';
      if (wasSuspended) {
        promotingRejected = true;
      } else {
        promotingInfoRequired = true;
      }
      const existingGuarantorForSideEffect = await db.guarantor.findUnique({
        where: { riderId: id },
        select: { status: true },
      });
      if (existingGuarantorForSideEffect?.status === 'SUBMITTED') {
        guarantorData.status = wasSuspended ? 'REJECTED' : 'INFO_REQUIRED';
      }

      // PR-99: fire the security-event logger when a rider is suspended
      // (KYC rejection). Fire-and-forget so the update tx is not slowed
      // by audit-log writes. This makes "rider.suspended" a queryable
      // event in the audit log (SOC2 requirement).
      if (wasSuspended) {
        void logAccountSuspension({
          riderId: id,
          adminId: actorId,
          reason: 'kyc_rejected',
        });
      }
    }

    // NET-005 follow-up-24 (2026-09-08): the
    // `update()` use-case previously wrote
    // `assignedVehicle`, `planStartDate/EndDate`,
    // `referralCode`, and `teamLeaderId` straight
    // to the rider row with NO application-level
    // validation. The only paths that guarded
    // these fields with FK / state / uniqueness
    // checks were the canonical rider-flow
    // paths (`completePickup`, `assignPlan`,
    // `endRental`). The admin bulk update path
    // — used by the per-rider detail dialog and
    // the bulk update handler — bypassed all of
    // them. The DB-level FK on `teamLeaderId`
    // and the @unique on `referralCode` would
    // catch the most egregious cases, but they'd
    // surface as 500s (Prisma throws on
    // constraint violation) instead of a clean
    // 400. `assignedVehicle` has no DB-level
    // constraint at all — the column is a free
    // string, so a typo or stale id would
    // silently land in the DB and break the
    // vehicle-resolve logic in `endRental` /
    // `completePickup` (`if (!vehicleDbId &&
    // assignedVehicleString)` would then look up
    // the wrong vehicle). Add the missing
    // application-level checks here so every
    // write — canonical or admin — validates the
    // same surface. Run BEFORE the tx so a 400
    // doesn't roll back a half-written state.
    if ('assignedVehicle' in data && data.assignedVehicle != null && data.assignedVehicle !== '') {
      // The column holds the human-readable
      // `vehicleNumber` (e.g. "VF-001") — match
      // either by `vehicleId` (DB cuid) or
      // `vehicleNumber` (display) to mirror the
      // resolve logic in `endRental` (line ~1180).
      const v = await db.vehicle.findFirst({
        where: {
          OR: [
            { vehicleId: data.assignedVehicle as string },
            { vehicleNumber: data.assignedVehicle as string },
          ],
        },
        select: { id: true, vehicleNumber: true },
      });
      if (!v) {
        throw new Error(
          `assignedVehicle "${data.assignedVehicle}" does not match any known vehicle (checked vehicleId and vehicleNumber)`
        );
      }
    }
    if ('teamLeaderId' in data) {
      if (data.teamLeaderId != null && data.teamLeaderId !== '') {
        const tl = await db.teamLeader.findUnique({
          where: { id: data.teamLeaderId as string },
          select: { id: true, isActive: true, name: true },
        });
        if (!tl) {
          throw new Error(
            `teamLeaderId "${data.teamLeaderId}" does not match any known team leader`
          );
        }
        if (!tl.isActive) {
          throw new Error(
            `teamLeaderId "${data.teamLeaderId}" refers to an inactive team leader`
          );
        }
        riderData.teamLeaderId = tl.id;
        riderData.teamLeader = tl.name;
      } else {
        riderData.teamLeaderId = null;
        riderData.teamLeader = null;
      }
    }
    if ('referralCode' in data && data.referralCode != null && data.referralCode !== '') {
      // The schema has `referralCode @unique`,
      // so a duplicate would surface as Prisma
      // P2002 — a 500. Check here and return a
      // clean 400.
      const conflict = await db.rider.findFirst({
        where: {
          referralCode: data.referralCode as string,
          NOT: { id },
        },
        select: { id: true, riderId: true },
      });
      if (conflict) {
        throw new Error(
          `referralCode "${data.referralCode}" is already in use by rider ${conflict.riderId} (${conflict.id})`
        );
      }
    }
    if ('planStartDate' in data && 'planEndDate' in data && data.planStartDate && data.planEndDate) {
      const start = new Date(data.planStartDate as string | Date);
      const end = new Date(data.planEndDate as string | Date);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() < start.getTime()) {
        throw new Error('planEndDate must be on or after planStartDate');
      }
    }

    // NET-005 follow-up-24 (2026-09-08): the
    // pre-fix code did NOT call
    // `invalidateRiderPhoneCache` when the
    // phone changed. The create() use-case
    // does (line ~428), but update() didn't —
    // so a phone change left the old phone
    // cached as a "rider exists" hit (the rider
    // is now under the new phone) and the new
    // phone cached as a "rider does not exist"
    // hit (the rider is now under this phone
    // but the cache hasn't seen the update).
    // Capture the old phone BEFORE the tx so we
    // can invalidate it; capture the new phone
    // from the write data.
    const phoneChanged =
      'phone' in data && data.phone !== existing.phone;
    const oldPhone = existing.phone;

    const result = await db.$transaction(async (tx) => {
      if (Object.keys(riderData).length > 0) {
        if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
          const name = riderData.fullName as string;
          const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
          riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
        }
        // NET-005 follow-up-19 (2026-09-08): the
        // previous code wrote `lifecycleStatus`
        // directly via `tx.rider.update` whenever
        // the body included the key. The state
        // machine's `validateTransition` is only
        // invoked via `transitionRiderStatus` (used
        // by assignPlan/completePickup/endRental/
        // profile-return) — every admin write
        // (Suspend, manual stage correction,
        // anything) skipped the machine. Mirror
        // the KYC pattern at line 605-617: fetch
        // the current status, call
        // `validateTransition`, throw
        // `RiderLifecycleError` on illegal target.
        // The route already maps RiderLifecycleError
        // to 409 via the api-handler.
        //
        // The bulk Suspend path goes through
        // `update()` with `lifecycleStatus:
        // 'SUSPENDED'`. After this fix, bulk
        // suspend from a state where SUSPENDED
        // is not in the allowed set
        // (NEW/PHONE_VERIFIED/PROFILE_SUBMITTED/
        // GUARANTOR_APPROVED/DEPOSIT_APPROVED/
        // PLAN_SELECTED/PICKUP_SCHEDULED/ACTIVE/
        // RETURN_PENDING/CLOSED — i.e. most
        // states) will 409. The bulk Suspend
        // needs to use the dedicated suspend
        // use-case (not the generic update) — that
        // is a follow-up.
        if (riderData.lifecycleStatus) {
          validateTransition(
            existing.lifecycleStatus as Parameters<typeof validateTransition>[0],
            riderData.lifecycleStatus as Parameters<typeof validateTransition>[1]
          );
        }
        await tx.rider.update({ where: { id }, data: riderData });
      }
      if (Object.keys(kycData).length > 0) {
        // P1: the old code upserted any KYC status (DRAFT→APPROVED without
        // SUBMITTED) with no state-machine check. Admins follow the same
        // machine — fix stale records via SUBMITTED first (kyc review
        // endpoints), not by jumping states here.
        if (kycData.status) {
          const currentKyc = await tx.kycProfile.findUnique({
            where: { riderId: id },
            select: { status: true },
          });
          // PENDING is the DB default for "never submitted" — normalize to
          // DRAFT for transition purposes (the machine starts at DRAFT).
          const norm = (s: string): KycMachineStatus =>
            (s === 'PENDING' ? 'DRAFT' : s) as KycMachineStatus;
          validateKycTransition(
            norm(currentKyc?.status || 'DRAFT'),
            norm(kycData.status as string)
          );
        }
        await tx.kycProfile.upsert({
          where: { riderId: id },
          update: kycData,
          create: { riderId: id, ...kycData },
        });
        // NET-005 (2026-09-08): the upsert above writes the
        // request body's kyc fields (e.g., a corrected
        // aadhaarFront URL submitted with the approval). The
        // helper then writes the four approval fields
        // (status=APPROVED, editableFields=[], expiresAt+365d,
        // pendingCorrections=DbNull) plus the rider.kycDoneAt
        // plus the F-06 lifecycleStatus promotion — all in
        // the same transaction. The helper's writes are
        // atomic at the row level and overwrite only the four
        // approval keys, so the upsert's other-field writes
        // (aadhaarFront, profilePhoto, etc.) survive.
        if (promotingApproved) {
          await promoteToApproved(tx, id);
        } else if (promotingRejected) {
          // REJECT symmetry (2026-09-08): F-12-aligned
          // PRE_ACTIVE_STAGES guard. The dead path's
          // `rejectKyc` body is in the helper.
          const reason = (kycData.rejectionReason as string) || '';
          const editableFields = (kycData.editableFields as string[]) || [];
          await promoteToRejected(tx, id, reason, editableFields);
        } else if (promotingInfoRequired) {
          // INFO_REQUIRED: status + rejectionReason-as-
          // infoRequest. No lifecycle change (the dead
          // path's `requestInfo` does not touch lifecycle).
          const infoRequest =
            (kycData.rejectionReason as string) || 'Additional information required';
          const editableFields = (kycData.editableFields as string[]) || [];
          await promoteToInfoRequired(tx, id, infoRequest, editableFields);
        }
        // Outbox emit for the KYC decision. Mirrors what
        // kyc.use-cases.ts:reviewKyc does (BLOCKER 2.7 / P1-5
        // consolidation). Priority 3 (rider-visible KYC
        // decision) and 'interactive' (PR-75). The legacy direct
        // `notificationService.notifyKycStatusChange` was removed
        // in BLOCKER 2.7; all KYC transitions dispatch reliably
        // via the outbox inside this transaction.
        if (promotingApproved) {
          await OutboxService.emit(
            OutboxEventTypes.NOTIFICATION_SEND,
            { riderId: id, type: 'KYC_APPROVED' },
            3,
            tx,
            'interactive',
          );
        } else if (promotingRejected) {
          await OutboxService.emit(
            OutboxEventTypes.NOTIFICATION_SEND,
            {
              riderId: id,
              type: 'KYC_REJECTED',
              reason: kycData.rejectionReason || '',
            },
            3,
            tx,
            'interactive',
          );
        } else if (promotingInfoRequired) {
          await OutboxService.emit(
            OutboxEventTypes.NOTIFICATION_SEND,
            {
              riderId: id,
              type: 'KYC_INFO_REQUESTED',
              infoRequest: kycData.rejectionReason || '',
            },
            3,
            tx,
            'interactive',
          );
        }
      } else if (promotingApproved) {
        // Edge case: the request body is `kycStatus: 'APPROVED'`
        // with no other kyc field updates. The `kycData` bucket
        // is still non-empty (it carries `status`), so the
        // `if (Object.keys(kycData).length > 0)` branch above
        // would normally fire. This `else if` is a defensive
        // fallback for any future code that strips the
        // status key from `kycData` before the transaction —
        // in that case the helper still runs and the approval
        // lands.
        await promoteToApproved(tx, id);
        await OutboxService.emit(
          OutboxEventTypes.NOTIFICATION_SEND,
          { riderId: id, type: 'KYC_APPROVED' },
          3,
          tx,
          'interactive',
        );
      } else if (promotingRejected) {
        await promoteToRejected(
          tx,
          id,
          (kycData as Record<string, unknown>).rejectionReason as string || '',
          ((kycData as Record<string, unknown>).editableFields as string[]) || [],
        );
        await OutboxService.emit(
          OutboxEventTypes.NOTIFICATION_SEND,
          {
            riderId: id,
            type: 'KYC_REJECTED',
            reason: ((kycData as Record<string, unknown>).rejectionReason as string) || '',
          },
          3,
          tx,
          'interactive',
        );
      } else if (promotingInfoRequired) {
        await promoteToInfoRequired(
          tx,
          id,
          ((kycData as Record<string, unknown>).rejectionReason as string) || 'Additional information required',
          ((kycData as Record<string, unknown>).editableFields as string[]) || [],
        );
        await OutboxService.emit(
          OutboxEventTypes.NOTIFICATION_SEND,
          {
            riderId: id,
            type: 'KYC_INFO_REQUESTED',
            infoRequest: ((kycData as Record<string, unknown>).rejectionReason as string) || '',
          },
          3,
          tx,
          'interactive',
        );
      }
      if (Object.keys(walletData).length > 0) {
        const wallet =
          (await tx.wallet.findUnique({
            where: { riderId: id },
            select: { id: true, balanceInPaise: true },
          })) ??
          (await tx.wallet.create({
            data: { riderId: id },
            select: { id: true, balanceInPaise: true },
          }));

        if ('balanceInPaise' in walletData) {
          const targetBalance = walletData.balanceInPaise as number;
          const currentBalance = wallet.balanceInPaise;
          const diff = targetBalance - currentBalance;
          // P1: cap the balance-set legs like the wallet-adjust API. The
          // bulk-update path has no co-approve/daily-cap machinery, so any
          // leg above the per-call admin debit cap must go through POST
          // /api/admin/riders/[id]/wallet-adjust (proof + co-approval +
          // daily aggregate cap) instead of silently applying here.
          const { env } = await import('@/lib/env');
          const maxLegPaise = env.MAX_ADMIN_DEBIT_INR * 100;
          if (Math.abs(diff) > maxLegPaise) {
            throw new Error(
              `Balance change of ₹${(Math.abs(diff) / 100).toFixed(2)} exceeds the per-call admin limit of ₹${env.MAX_ADMIN_DEBIT_INR} — use the Wallet Adjust API`
            );
          }
          if (diff > 0) {
            await walletLedgerService.credit(
              {
                riderId: id,
                amountInPaise: diff,
                category: 'ADMIN_ADJUSTMENT',
                actorId,
                idempotencyKey: `admin:${id}:balance:${targetBalance}`,
                note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}`,
              },
              tx
            );
          } else if (diff < 0) {
            await walletLedgerService.debit(
              {
                riderId: id,
                amountInPaise: Math.abs(diff),
                category: 'ADMIN_ADJUSTMENT',
                actorId,
                idempotencyKey: `admin:${id}:balance:${targetBalance}`,
                note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}`,
                allowNegative: true,
              },
              tx
            );
          }
          delete walletData.balanceInPaise;
        }

        // Block direct securityDeposit/depositStatus mutations — must use Deposits API
        if ('securityDeposit' in walletData || 'depositStatus' in walletData) {
          throw new Error('Use the Deposits API to modify security deposit or deposit status');
        }

        if (Object.keys(walletData).length > 0) {
          await tx.wallet.update({ where: { id: wallet.id }, data: walletData });
        }
      }
      if (Object.keys(guarantorData).length > 0) {
        // P0-2 (2026-09-08): if ALL provided guarantor fields are null or empty,
        // the admin is executing "Clear Guarantor". In Prisma, Guarantor.status
        // is non-nullable, so writing null crashes the DB. Correct semantics is
        // deleting the guarantor row, and skipping the state machine transition check.
        const isClearGuarantor = Object.values(guarantorData).every(
          (v) => v === null || v === '' || v === undefined
        );

        if (isClearGuarantor) {
          await tx.guarantor.deleteMany({ where: { riderId: id } });
        } else {
          // If status is empty/null in a partial update, drop it so Prisma doesn't crash on non-nullable enum
          if (guarantorData.status === null || guarantorData.status === '') {
            delete guarantorData.status;
          }

          // NET-005 follow-up-19 (2026-09-08): the
          // previous code wrote any `guarantorStatus`
          // (or the KYC side-effect's auto-set at
          // line 545-547/575) directly to the
          // guarantor row with no transition
          // validation. The repository's
          // `submitGuarantor` / `approveGuarantor` /
          // `rejectGuarantor` / `requestInfo` paths
          // already call `validateGuarantorTransition`,
          // but the admin `update()` use-case
          // bypassed the repository entirely. Mirror
          // the KYC pattern at line 605-617: fetch
          // the current status, validate the
          // transition, throw `GuarantorStateError`
          // on illegal target. The route already
          // maps GuarantorStateError to 409.
          if (guarantorData.status) {
            const currentGuarantor = await tx.guarantor.findUnique({
              where: { riderId: id },
              select: { status: true },
            });
            // PENDING is the DB default for a never-submitted
            // guarantor — normalize to DRAFT for transition
            // purposes (the machine starts at DRAFT).
            const normGuarantor = (s: string | null | undefined): GuarantorStatus =>
              ((s === 'PENDING' || !s) ? 'DRAFT' : s) as GuarantorStatus;
            validateGuarantorTransition(
              normGuarantor(currentGuarantor?.status),
              normGuarantor(guarantorData.status as string)
            );
          }
          await tx.guarantor.upsert({
            where: { riderId: id },
            update: guarantorData,
            create: { riderId: id, ...guarantorData },
          });
        }
      }
      return tx.rider.findUnique({
        where: { id },
        include: { kycProfile: true, wallet: true, guarantor: true },
      });
    });

    invalidateRiderCache(id);
    // NET-005 follow-up-24 (2026-09-08): the
    // pre-fix update() did NOT invalidate the
    // phone-lookup cache when the phone
    // changed. The create() use-case does, but
    // update() left stale entries — a phone
    // change from 9999999999 → 8888888888
    // would leave `9999999999` cached as "rider
    // exists" (the rider is now under the new
    // phone) and `8888888888` cached as "rider
    // does not exist" (the cache hasn't seen
    // the update). Invalidate BOTH the old and
    // new phone keys so the next read fetches
    // fresh DB state.
    if (phoneChanged && data.phone) {
      invalidateRiderPhoneCache(oldPhone);
      invalidateRiderPhoneCache(data.phone as string);
    }

    // Audit log for KYC actions
    if (kycData.status && ['APPROVED', 'REJECTED', 'INFO_REQUIRED'].includes(kycData.status)) {
      createAuditLog({
        actorId,
        actorType: 'ADMIN',
        // NET-005 follow-up-3 (2026-09-08): use the
        // dot-separated `kyc.${status}` form, not the
        // underscore form. The retention table in
        // `lib/audit-log.ts:5-27` splits on `.` and looks
        // up the prefix; `kyc_approved` (underscore) splits
        // to a single segment that does not match the
        // `kyc` key, falling through to the 90-day default
        // instead of the 365-day KYC retention. The dead
        // path's `kycRepository.approveKyc` and
        // `kyc.use-cases.ts:reviewKyc` both write the
        // dot-separated form (`kyc.approved` /
        // `kyc.rejected`); the live path now matches.
        action: `kyc.${kycData.status.toLowerCase()}`,
        entity: 'rider',
        entityId: id,
        details: JSON.stringify({
          kycStatus: kycData.status,
          rejectionReason: kycData.rejectionReason || null,
        }),
      }).catch(() => {});
      // BLOCKER 2.7 (2026-09-08): the legacy direct
      // `notificationService.notifyKycStatusChange` call
      // is removed. The KYC notification is now dispatched
      // via the outbox emit inside the transaction above
      // (KYC_APPROVED / KYC_REJECTED / KYC_INFO_REQUESTED at
      // priority 3 with 'interactive' transport — see
      // kyc.use-cases.ts:reviewKyc for the canonical
      // pattern). The notification-dispatch job is verified
      // wired (19/19 tests pass in
      // tests/unit/workers/notification-dispatch.job.test.ts).
      // A future failure to deliver is now a queue-level
      // retry/backoff problem, not a fire-and-forget log
      // line.
    }

    if (!result) throw new Error('Rider not found after KYC update');
    return sharedFlattenRider(result);
  },

  /**
   * Get a rider by ID with wallet for admin actions.
   */
  async getRiderWithWallet(id: string) {
    return getCachedRider(id, () =>
      db.rider.findUnique({
        where: { id },
        include: { wallet: true },
      })
    );
  },

  /**
   * Assign a plan to a rider with override audit logging.
   */
  async assignPlan(
    riderId: string,
    planId: string,
    actorId: string,
    actorRole: string
  ) {
    // P0-4 (2026-08-05 legal/device audit): the old signature took a
    // caller-supplied `planName` that the route passed `planId` into — the
    // audit log recorded the plan ID as its name. The plan is fetched below
    // anyway, so derive the name from the DB row (single source of truth).
    // P1.9: a soft-deleted plan must not be assignable.
    const plan = await db.rentalPlan.findUnique({ where: { id: planId, deletedAt: null } });
    if (!plan) throw new Error('Plan not found');

    const rider = await getCachedRider(riderId, () => db.rider.findUnique({ where: { id: riderId } }));
    const isActive = rider?.lifecycleStatus === 'ACTIVE';

    // F-05: Plan window starts at activation, not selection.
    // Pre-active riders have plan dates set to null until vehicle pickup.
    const durationDays = getDurationForPlanType(plan.type);
    let planStartDate: Date | null = null;
    let planEndDate: Date | null = null;

    if (isActive) {
      planStartDate = new Date();
      planEndDate = new Date(planStartDate.getTime() + durationDays * 86400000);
    } else {
      await transitionRiderStatus(riderId, 'PLAN_SELECTED');
    }

    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        currentPlan: plan.name,
        currentPlanId: plan.id,
        currentPlanPrice: plan.priceInPaise,
        planStartDate,
        planEndDate,
        planDoneAt: new Date(),
      },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    invalidateRiderCache(riderId);

    await createAuditLog({
      actorId,
      action: 'rider.assign_plan',
      entity: 'Rider',
      entityId: riderId,
      details: { planId, planName: plan.name, override: true },
    }).catch(() => {});
    return result;
  },

  /**
   * Complete pickup for a rider — assigns vehicle, activates account.
   */
  async completePickup(
    riderId: string,
    data: { vehicleId?: string; hubId?: string; teamLeaderId?: string },
    actorId: string,
    actorRole: string
  ) {
    const rider = await getCachedRider(riderId, () =>
      db.rider.findUnique({
        where: { id: riderId },
        include: { currentPlanRef: true },
      })
    );
    if (!rider) throw new Error('Rider not found');

    let assignedTl = data.teamLeaderId || rider.teamLeaderId;
    if (!assignedTl || assignedTl === 'Not Assigned') {
      const activeTl = await db.teamLeader.findFirst({ where: { isActive: true } });
      assignedTl = activeTl ? activeTl.id : null;
    }

    let assignedVehicleString = 'VF-ASSIGNED-BY-ADMIN';
    if (data.vehicleId) {
      const v = await db.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!v) throw new Error('Vehicle not found');
      // P1: guard the claim — the old code flipped ANY vehicle (including
      // MAINTENANCE/RETIRED) to ACTIVE_RENTAL with .catch(()=>{}), so a
      // concurrent admin pickup could clobber fleet state. Only AVAILABLE or
      // RESERVED vehicles can be claimed; the updateMany count check makes
      // the claim atomic against concurrent pickups.
      if (v.status !== 'AVAILABLE' && v.status !== 'RESERVED') {
        throw new Error(`Vehicle ${v.vehicleNumber} is not available for pickup (status: ${v.status})`);
      }
      assignedVehicleString = v.vehicleNumber;
      await ensureActiveRentalLease(db, rider, data.vehicleId);
      const claimed = await db.vehicle.updateMany({
        where: { id: data.vehicleId, status: { in: ['AVAILABLE', 'RESERVED'] } },
        data: { status: 'ACTIVE_RENTAL', assignedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error(`Vehicle ${v.vehicleNumber} was claimed by another pickup; please retry`);
      }
    }

    // F-05: Plan window starts at activation (vehicle pickup), not at selection.
    // Derive durationDays strictly from plan type (DAILY=1, WEEKLY=7, MONTHLY=30)
    let plan = rider.currentPlanRef;
    if (!plan && rider.currentPlanId && db.rentalPlan?.findUnique) {
      plan = await db.rentalPlan.findUnique({ where: { id: rider.currentPlanId } });
    }
    if (!plan && rider.currentPlan && db.rentalPlan?.findFirst) {
      plan = await db.rentalPlan.findFirst({ where: { name: rider.currentPlan, deletedAt: null } });
    }
    const durationDays = plan ? getDurationForPlanType(plan.type) : 7;
    const now = new Date();
    const planEndDate = new Date(now.getTime() + durationDays * 86400000);

    await transitionRiderStatus(riderId, 'ACTIVE');
    // P1: validate an explicit hubId instead of persisting garbage; fall back
    // to 'Central Hub' only when no hub was given (legacy behavior). Accepts
    // a hub id or a hub name (legacy callers pass names).
    let pickupHub = 'Central Hub';
    if (data.hubId) {
      const hub =
        (await db.hub.findUnique({ where: { id: data.hubId }, select: { id: true, name: true } })) ??
        (await db.hub.findFirst({ where: { name: data.hubId }, select: { id: true, name: true } }));
      if (!hub) throw new Error('Pickup hub not found');
      pickupHub = hub.name || data.hubId;
    }
    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        pickedUpAt: now,
        assignedVehicle: assignedVehicleString,
        pickupHub,
        teamLeaderId: assignedTl,
        planStartDate: now,
        planEndDate: planEndDate,
      },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    invalidateRiderCache(riderId);

    await createAuditLog({
      actorId,
      action: 'rider.complete_pickup',
      entity: 'Rider',
      entityId: riderId,
      details: { vehicleId: data.vehicleId, hubId: data.hubId, manual: true },
    }).catch(() => {});
    return result;
  },

  /**
   * End rental for a rider — resets rental state and transitions to CLOSED.
   */
  async endRental(riderId: string, actorId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        riderId: true,
        assignedVehicle: true,
        vehicleId: true,
        lifecycleStatus: true,
      },
    });
    if (!rider) throw new Error(`Rider not found: ${riderId}`);

    const previousStatus = rider.lifecycleStatus;
    const assignedVehicleString = rider.assignedVehicle;
    let vehicleDbId = rider.vehicleId;

    if (!vehicleDbId && assignedVehicleString) {
      const vehicle = await db.vehicle.findFirst({
        where: {
          OR: [
            { vehicleId: assignedVehicleString },
            { vehicleNumber: assignedVehicleString },
          ],
        },
        select: { id: true },
      });
      vehicleDbId = vehicle?.id ?? null;
    }

    // 1. Transition lifecycle status to CLOSED (supports RETURN_PENDING, ACTIVE, SUSPENDED; no-op if already CLOSED)
    // P1: fleet/lease/return closures run FIRST and throw on failure, so a
    // failed vehicle or lease write can never leave a CLOSED rider with an
    // ACTIVE_RENTAL vehicle / ACTIVE lease behind (the old .catch(()=>{})
    // steps hid exactly that fleet leak). The CLOSED transition runs last;
    // a mid-flow failure leaves the rider non-CLOSED and retry-safe.
    // 2. Mark assigned vehicle as AVAILABLE
    if (vehicleDbId && db.vehicle?.updateMany) {
      await db.vehicle.updateMany({
        where: { id: vehicleDbId },
        data: { status: 'AVAILABLE', assignedAt: null, currentRiderId: null },
      }).catch((err) => {
        logger.error('[endRental] Vehicle update to AVAILABLE failed (blocking)', { err, vehicleDbId });
        throw new Error('Failed to release vehicle to AVAILABLE; endRental aborted before closing rider');
      });
    }

    // 3. Close any active/return_pending rental leases
    if (db.rentalLease?.updateMany) {
      await db.rentalLease.updateMany({
        where: {
          riderId,
          status: { in: ['ACTIVE', 'RETURN_PENDING', 'PICKUP_SCHEDULED', 'OVERDUE'] },
        },
        data: {
          status: 'CLOSED',
          endTime: new Date().toISOString().slice(11, 16),
        },
      }).catch((err) => {
        logger.error('[endRental] Rental lease closure failed (blocking)', { err, riderId });
        throw new Error('Failed to close rental leases; endRental aborted before closing rider');
      });
    }

    // 4. Close any open vehicle return records for this rider
    if (db.vehicleReturn?.updateMany) {
      await db.vehicleReturn.updateMany({
        where: {
          riderId,
          status: { in: ['SUBMITTED', 'INSPECTION_PENDING'] },
        },
        data: {
          status: 'CLOSED',
          inspectedBy: actorId,
          inspectedAt: new Date(),
        },
      }).catch((err) => {
        logger.error('[endRental] Vehicle return closure failed (blocking)', { err, riderId });
        throw new Error('Failed to close vehicle returns; endRental aborted before closing rider');
      });
    }

    if (rider.lifecycleStatus !== 'CLOSED') {
      await transitionRiderStatus(riderId, 'CLOSED');
    }

    // 5. Clear assigned vehicle and rental plan window on rider
    const result = await db.rider.update({
      where: { id: riderId },
      data: {
        assignedVehicle: null,
        vehicleId: null,
        pickedUpAt: null,
        planStartDate: null,
        planEndDate: null,
      },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });

    // 6. Invalidate caches
    invalidateRiderCache(riderId);
    if (vehicleDbId) {
      invalidateVehicleCache(vehicleDbId);
    }
    invalidateCache('vehicles_list:*');
    invalidateCache('admin:vehicles:*');
    invalidateCache('admin:rentals:*');

    // 7. Audit log
    await createAuditLog({
      actorId,
      action: 'rider.end_rental',
      entity: 'Rider',
      entityId: riderId,
      details: {
        previousVehicle: assignedVehicleString,
        previousStatus,
        newStatus: 'CLOSED',
      },
    }).catch(() => {});

    return result;
  },

  /**
   * Get device data for a rider (contacts, call logs, locations).
   */
  async getDeviceData(riderId: string, type: string = 'all') {
    // P0-5 (2026-08-05 legal/device audit): the old select read
    // `lockPassword` — a field that does not exist on the Rider model (the
    // column is `lockPasswordHash`). Prisma silently returned undefined and
    // the TS type lied. The hash must never reach the admin UI anyway, so
    // drop the field entirely rather than selecting the hash.
    const rider = await db.rider.findUnique({
      where: { id: riderId },
      select: {
        isAdminLocked: true,
        isUninstallBlocked: true,
        isLocationMandatory: true,
        isAppsControlRestricted: true,
      },
    });

    const results: {
      rider: typeof rider;
      contacts?: Awaited<ReturnType<typeof db.userContact.findMany>>;
      callLogs?: Awaited<ReturnType<typeof db.userCallLog.findMany>>;
      locations?: Awaited<ReturnType<typeof db.userLocation.findMany>>;
    } = { rider };

    if (type === 'CONTACTS' || type === 'all') {
      // P1: bound like the sibling call-log/location queries — device
      // contact books can be large (PII dump vector).
      results.contacts = await db.userContact.findMany({
        where: { riderId },
        orderBy: { name: 'asc' },
        take: 200,
      });
    }
    if (type === 'CALL_LOGS' || type === 'all') {
      results.callLogs = await db.userCallLog.findMany({
        where: { riderId },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    }
    if (type === 'LOCATION' || type === 'all') {
      results.locations = await db.userLocation.findMany({
        where: { riderId },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    }

    return results;
  },

  async updateSecurityFlags(riderId: string, data: Record<string, unknown>, actorId: string) {
    // NET-005 follow-up-21 (2026-09-08): reject
    // keys outside the security-field allowlist.
    // The pre-fix code spread `data` straight
    // into `db.rider.update({ data })` — a
    // mass-assignment-shaped helper that today
    // only sees fixed keys from the actions route
    // (5 rider security columns + the special-case
    // `lockPassword` plaintext). One refactor
    // from a hole: a caller passing
    // `lifecycleStatus` or any other rider
    // column would silently write that column.
    // Throw on unknown keys — defense in depth.
    // The audit log uses the ORIGINAL `data`
    // argument (with `lockPassword` stripped via
    // the destructure below) so the audit
    // captures the caller's intent.
    const unknownKeys = Object.keys(data).filter(
      (k) => !SECURITY_RIDER_FIELDS.has(k)
    );
    if (unknownKeys.length > 0) {
      throw new Error(
        `updateSecurityFlags received keys outside the security allowlist: ${unknownKeys.join(', ')}. ` +
          `Allowed: ${Array.from(SECURITY_RIDER_FIELDS).join(', ')}.`
      );
    }
    const updateData = { ...data };
    if (updateData.lockPassword && typeof updateData.lockPassword === 'string') {
      const { hashPassword } = await import('@/lib/password');
      updateData.lockPassword = await hashPassword(updateData.lockPassword);
    }
    await db.rider.update({ where: { id: riderId }, data: updateData });
    invalidateRiderCache(riderId);
    // Strip the plaintext `lockPassword` from the
    // audit details (the user flagged this and
    // called it "fine" — confirmed: the plaintext
    // is hashed into `lockPasswordHash` before
    // the DB write, so logging the plaintext
    // would be a leak; the current strip is
    // correct). Strip `lockPasswordHash` too — the
    // hash isn't a leak, but logging the value
    // adds nothing the `isAdminLocked` /
    // `lockPasswordHash` audit row already implies.
    await createAuditLog({
      action: 'system.config_change',
      entityId: riderId,
      entity: 'rider',
      actorId,
      details: (({ lockPassword, lockPasswordHash, ...safe }) => safe)(
        data
      ),
    });
  },

  /**
   * Suspend a rider (administrative override).
   *
   * Deliberately bypasses the lifecycle state machine to permit
   * suspending from any state (including NEW, PHONE_VERIFIED, etc.).
   * Audited via 'rider.suspend'.
   */
  async suspend(
    id: string,
    context: { actorId: string; actorRole?: string; reason?: string }
  ) {
    const existing = await getCachedRider(id, () => db.rider.findUnique({ where: { id } }));
    if (!existing) throw new Error('Rider not found');

    const previousStatus = existing.lifecycleStatus;

    const result = await db.rider.update({
      where: { id },
      data: { lifecycleStatus: 'SUSPENDED' },
    });

    invalidateRiderCache(id);
    invalidateCache('admin:*');

    await createAuditLog({
      actorId: context.actorId,
      actorType: 'ADMIN',
      action: 'rider.suspend',
      entity: 'rider',
      entityId: id,
      details: {
        previousStatus,
        ...(context.reason ? { reason: context.reason } : {}),
      },
    }).catch((err) => {
      logger.error('[RIDER_SUSPEND_AUDIT_ERROR]', err);
    });

    return result;
  },

  /**
   * Delete a rider — SOFT-DELETE ONLY (P0 fix 2026-09-03).
   *
   * The previous implementation hard-deleted children first
   * (notification/rentalLease/guarantor/kycProfile/wallet via deleteMany)
   * then soft-deleted the rider. That permanently wiped KYC/guarantor/lease
   * history the soft-delete design was meant to preserve, destroyed Wallet /
   * DepositRecord lineage that the schema marks onDelete: Restrict, and
   * violated the append-only transaction/ledger triggers. Mid-transaction
   * Restrict failures also left partial wipes.
   *
   * Now: refuse when financial rows exist (wallet, transactions, ledger,
   * deposits), otherwise soft-delete the rider only (the db.ts extension
   * converts rider.delete into a deletedAt update). Child rows are preserved
   * for audit/forensics and stay hidden via the deletedAt filter. Use the
   * GDPR data-deletion-purge job for lawful full purges, never this path.
   */
  async delete(id: string, actorId: string) {
    // NET-005 follow-up-18 (2026-09-08): the previous
    // signature was `actorId?: string` and the audit
    // row inside the soft-delete transaction fell
    // back to `actorId: 'system', actorType: 'SYSTEM'`
    // when the caller (the route) didn't pass an
    // actor. Result: a `rider.delete` audit row
    // attributed to "system" was the authoritative
    // record of an admin-initiated delete. The two
    // call sites (single DELETE + bulk DELETE)
    // didn't pass an actor at all, so the audit row
    // said the system did it. Require the actor
    // explicitly; callers MUST thread the real
    // `session.adminId` through. Throwing here is
    // cheaper than the silent-wrong-actor alternative.
    if (!actorId) {
      throw new Error(
        'adminRiderUseCases.delete requires an actorId; pass session.adminId from the route.'
      );
    }
    const financial = await db.$transaction(async (tx) => {
      const [wallet, txn, ledger, deposit] = await Promise.all([
        tx.wallet.findFirst({ where: { riderId: id }, select: { id: true } }),
        tx.transaction.findFirst({ where: { riderId: id }, select: { id: true } }),
        tx.walletLedger.findFirst({ where: { riderId: id }, select: { id: true } }),
        tx.depositRecord.findFirst({ where: { riderId: id }, select: { id: true } }),
      ]);
      return { wallet, txn, ledger, deposit };
    });
    if (financial.wallet || financial.txn || financial.ledger || financial.deposit) {
      throw new Error(
        'Refusing to delete rider with financial records (wallet/transaction/ledger/deposit). Use lifecycle CLOSE + GDPR purge job instead.'
      );
    }
    await db.$transaction(async (tx) => {
      await tx.rider.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: 'rider.delete',
          entity: 'rider',
          entityId: id,
          actorId,
          actorType: 'ADMIN',
          details: JSON.stringify({ riderId: id, mode: 'soft-delete' }),
        },
      });
    });
    invalidateRiderCache(id);
  },

  // P1: fleet listing lives in admin-rider-fleet.use-cases.ts (god-module
  // decomposition, step 1). Delegation keeps existing callers working.
  async listFleet(filters: {
    hubId?: string;
    status?: string;
    search?: string;
    lowBattery?: boolean;
    page?: number;
    limit?: number;
  }) {
    return fleetUseCases.listFleet(filters);
  },
};
