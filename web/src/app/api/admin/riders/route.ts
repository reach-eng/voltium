/**
 * GET    /api/admin/riders — List riders with filters, search, pagination
 * POST   /api/admin/riders — Create a new rider
 * PUT    /api/admin/riders — Update rider (core, KYC, wallet, guarantor fields)
 * DELETE /api/admin/riders — Delete rider (cascade)
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in adminRiderUseCases / rider lifecycles.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { parseLooseDate } from '@/lib/date-utils';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { invalidateRiderCache } from '@/lib/server-cache';
import { logKycDocumentView } from '@/lib/security-events';
import { adminRiderUseCases, RiderPhoneExistsError } from '@/server/modules/riders/admin-riders.use-cases';
import { KycStateError } from '@/server/modules/kyc/kyc-state-machine';
import { GuarantorStateError } from '@/server/modules/guarantors/guarantor-state-machine';
import { DepositStateMachineError } from '@/server/modules/deposits/deposit-state-machine';
import { RentalStateError } from '@/server/modules/rentals/rental-state-machine';
import { parsePositiveInt } from '@/lib/api-utils';
import { toRupeesResponse } from '@/lib/api-money';
import { createRiderSchema, validateBody } from '@/lib/validators';

/**
 * Allowlisted update schema — prevents mass assignment by only accepting
 * explicitly declared fields with their correct types.
 *
 * ADMIN-RIDER-AUDIT P0-2 (2026-09-08): five field-shape fixes that
 * closed the silent-failure cluster:
 *  - P0-2a: guarantor text fields accept `null` and `''` so the
 *    "Clear Guarantor" admin action can wipe them.
 *  - P0-2b: KYC doc URL fields accept `null` so per-doc delete and
 *    bulk delete can remove them.
 *  - P0-2c: `lifecycleStatus` is now in the allowlist so the
 *    per-rider detail dialog's Lifecycle Status dropdown can write
 *    to it (the use-case allowlist was already updated in P0-1).
 *  - P0-2d: `depositStatus` is intentionally NOT here — the use-case
 *    `update()` throws "Use the Deposits API" for direct
 *    depositStatus/securityDeposit writes. The MoneyTab UI now
 *    renders the status as a read-only badge.
 *  - P0-2e: `intent` accepts `''` (null-intent riders exist in the
 *    DB) and `dob` accepts both `dd-MM-yyyy` and `yyyy-MM-dd`
 *    (the rider app sends ISO; the admin form sends Indian).
 *
 * Exported so unit tests can assert the wire shape directly
 * (`tests/unit/admin-rider-security.test.ts`).
 */
export const updateRiderSchema = z.object({
  id: z.string().min(1),
  // Core rider fields
  fullName: z.string().min(2).max(100).nullish().or(z.literal('')),
  email: z.string().email().nullish().or(z.literal('')),
  fatherName: z.string().max(100).nullish().or(z.literal('')),
  motherName: z.string().max(100).nullish().or(z.literal('')),
  dob: z
    .string()
    .regex(/^(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})$/, 'DOB must be yyyy-MM-dd or dd-MM-yyyy')
    .nullish()
    .or(z.literal('')),
  currentAddress: z.string().max(500).nullish().or(z.literal('')),
  emergencyContact: z.string().max(20).nullish().or(z.literal('')),
  pickupHub: z.string().max(100).nullish().or(z.literal('')),
  teamLeader: z.string().max(100).nullish().or(z.literal('')),
  planStartDate: z.string().datetime().nullish().or(z.literal('')),
  planEndDate: z.string().datetime().nullish().or(z.literal('')),
  // P0-2e: null-intent riders exist in the DB. The edit form
  // sometimes sends `''`; accept it (and `null` / `undefined`)
  // so the save does not 400.
  intent: z.enum(['deliver', 'personal']).nullish().or(z.literal('')),
  referralCode: z.string().max(20).nullish().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\d{10}$/)
    .nullish()
    .or(z.literal('')),
  preferredShift: z.string().max(50).nullish().or(z.literal('')),
  referredBy: z.string().max(100).nullish().or(z.literal('')),
  assignedVehicle: z.string().max(100).optional().nullable(),
  // KYC fields
  kycStatus: z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED']).optional(),
  // P0-2b: KYC doc URL fields now accept `null` so the per-doc
  // delete (`confirmDeleteKycDoc`) and bulk delete
  // (`handleBulkDeleteKycDocs`) can wipe them. Empty string
  // was already accepted; the rider app's clear-snapshot path
  // also sends `''`.
  profilePhoto: z.string().url().nullish().or(z.literal('')),
  riderPhoto: z.string().url().nullish().or(z.literal('')),
  riderVideo: z.string().url().nullish().or(z.literal('')),
  signature: z.string().url().nullish().or(z.literal('')),
  aadhaarFront: z.string().url().nullish().or(z.literal('')),
  aadhaarBack: z.string().url().nullish().or(z.literal('')),
  aadhaarNumber: z.string().max(12).nullish().or(z.literal('')),
  panCard: z.string().url().nullish().or(z.literal('')),
  panNumber: z.string().max(10).nullish().or(z.literal('')),
  bankAccount: z.string().max(30).nullish().or(z.literal('')),
  bankIfsc: z.string().max(11).nullish().or(z.literal('')),
  bankName: z.string().max(100).nullish().or(z.literal('')),
  accountNumber: z.string().max(30).nullish().or(z.literal('')),
  ifscCode: z.string().max(11).nullish().or(z.literal('')),
  rejectionReason: z.string().max(500).nullish().or(z.literal('')),
  editableFields: z.array(z.string()).optional(),
  // Wallet fields
  walletBalance: z.number().optional(),
  // P0-2c: lifecycleStatus is the real column on the rider model
  // (`RiderLifecycleStatus` enum). The use-case allowlist was
  // extended in the prior commit (P0-1); the route schema is
  // the second gate. The KYC-status write at the use-case
  // still auto-progresses `lifecycleStatus` from rank-based
  // logic; this entry is for explicit admin overrides via the
  // per-rider detail dialog's Lifecycle Status dropdown
  // (RiderProfileTab / RiderJourneyTab).
  lifecycleStatus: z
    .enum([
      'NEW',
      'PHONE_VERIFIED',
      'PROFILE_SUBMITTED',
      'KYC_SUBMITTED',
      'KYC_APPROVED',
      'GUARANTOR_SUBMITTED',
      'GUARANTOR_APPROVED',
      'DEPOSIT_PENDING',
      'DEPOSIT_APPROVED',
      'PLAN_SELECTED',
      'PICKUP_SCHEDULED',
      'ACTIVE',
      'SUSPENDED',
      'RETURN_PENDING',
      'CLOSED',
    ])
    .nullish()
    .or(z.literal('')),
  // Guarantor fields
  guarantorStatus: z
    .enum(['PENDING', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED', 'REPLACED'])
    .nullish()
    .or(z.literal('')),
  // P0-2a: guarantor text fields now accept `null` and `''` so
  // the "Clear Guarantor" admin action can wipe them. Before
  // the fix, `confirmClearGuarantorAction` PUTs all-null
  // values and the route returned 400, which the client's
  // `if (res.ok)` branch silently swallowed — the local
  // state was updated as if the clear had succeeded but the
  // server's view was unchanged.
  guarantorName: z.string().max(100).nullish().or(z.literal('')),
  guarantorRelation: z.string().max(50).nullish().or(z.literal('')),
  guarantorPhone: z
    .string()
    .regex(/^\d{10}$/)
    .nullish()
    .or(z.literal('')),
  guarantorDob: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/)
    .nullish()
    .or(z.literal('')),
  guarantorAadhaarFront: z.string().url().nullish().or(z.literal('')),
  guarantorAadhaarBack: z.string().url().nullish().or(z.literal('')),
  guarantorPan: z.string().url().nullish().or(z.literal('')),
  guarantorVideo: z.string().url().nullish().or(z.literal('')),
  guarantorSignature: z.string().url().nullish().or(z.literal('')),
  guarantorFatherName: z.string().max(100).nullish().or(z.literal('')),
  guarantorMotherName: z.string().max(100).nullish().or(z.literal('')),
  guarantorAddress: z.string().max(500).nullish().or(z.literal('')),
  guarantorPhoto: z.string().url().nullish().or(z.literal('')),
});

// GET — list riders with full filters, search, pagination
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return errors.unauthorized();
  if (!hasPermission(session, 'riders_view')) {
    return errors.forbidden('Insufficient permissions to view riders');
  }

  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const state = url.searchParams.get('state') || '';
    const kycStatus = url.searchParams.get('kycStatus') || '';

    // P1-6 (Phase 6): kycStatus filter is specific to the KYC review queue.
    // Querying the KYC queue requires kyc_view permission.
    if (kycStatus && !hasPermission(session, 'kyc_view')) {
      return errors.forbidden('Insufficient permissions to view KYC queue; kyc_view required');
    }

    const startDateRaw = url.searchParams.get('startDate') || '';
    const endDateRaw = url.searchParams.get('endDate') || '';
    // NET-005 follow-up-14 (2026-09-08): the previous
    // implementation was `parseDDMMYYYY(...).toISOString()
    // || startDateRaw` — the `|| rawString` fallback
    // silently passed unparseable input to Prisma. The
    // filter "worked by accident" for ISO dates from
    // HTML `<input type="date">` because
    // `parseDDMMYYYY` already accepts ISO via its
    // `new Date()` fallback, but unparseable input
    // would never have been rejected at the boundary.
    // Use `parseLooseDate` (explicit name) and reject
    // with 400 if the input is non-empty but unparseable.
    let startDate = '';
    if (startDateRaw) {
      const parsed = parseLooseDate(startDateRaw);
      if (!parsed) {
        return errors.badRequest('startDate must be ISO (YYYY-MM-DD) or DD-MM-YYYY');
      }
      startDate = parsed.toISOString();
    }
    let endDate = '';
    if (endDateRaw) {
      const parsed = parseLooseDate(endDateRaw);
      if (!parsed) {
        return errors.badRequest('endDate must be ISO (YYYY-MM-DD) or DD-MM-YYYY');
      }
      endDate = parsed.toISOString();
    }
    const cursor = url.searchParams.get('cursor') || '';
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortDir = url.searchParams.get('sortDir') || 'desc';
    // PR-7 (1st audit P0-1): the data-deletion queue lists soft-deleted
    // riders via ?deleted=true. Without it, the middleware's default
    // `deletedAt: null` filter hides them forever.
    const deleted = url.searchParams.get('deleted') === 'true';

    const cacheKey = [
      'admin:riders',
      session.adminId ?? session.riderDbId ?? 'anon',
      search,
      state,
      kycStatus,
      startDate,
      endDate,
      cursor,
      page,
      limit,
      sortBy,
      sortDir,
      String(deleted),
    ].join(':');

    const result = await getOrSetResponse(cacheKey, () =>
      adminRiderUseCases.list({
        search,
        state,
        kycStatus,
        startDate,
        endDate,
        cursor: cursor || undefined,
        page,
        limit,
        sortBy,
        sortDir,
        deleted,
      }),
      5
    );

    // NET-005 follow-up-9 (2026-09-08): the live admin riders
    // list returns KYC document URLs (profilePhoto, aadhaarFront,
    // aadhaarBack, panCard, etc.) for every rider that has a
    // non-PENDING kycProfile. SOC2 requires that every admin
    // access to a rider's KYC data be recorded in the audit log.
    // The dead `kycRepository.findByRiderIdForAdmin` was added in
    // PR-99 to satisfy this but never wired up. Fire the
    // per-rider log at the route level so it covers every GET,
    // not just cache misses — admins viewing the cached list
    // are still viewing the data. The 5s `getOrSetResponse` TTL
    // bounds the volume (one write per admin per filter combo
    // per 5s). Fire-and-forget via `void`; never blocks the
    // response. documentType=`riders_list` distinguishes this
    // from the KYC queue and single-rider-detail views in the
    // security-event stream.
    // P1-6 (Phase 6): Gate KYC document fields on kyc_view permission.
    // Roles with riders_view but without kyc_view (e.g. Finance, Support, Fleet)
    // receive identity, contact, wallet, and lifecycle data, but sensitive
    // KYC document and photo evidence URLs are redacted.
    const canViewKyc = hasPermission(session, 'kyc_view');
    if (result && Array.isArray((result as { riders?: unknown[] }).riders)) {
      const adminId = session.adminId ?? session.riderDbId ?? 'unknown';
      for (const rider of (result as { riders: Array<Record<string, unknown>> }).riders) {
        if (!canViewKyc) {
          rider.profilePhoto = null;
          rider.riderPhoto = null;
          rider.riderVideo = null;
          rider.signature = null;
          rider.aadhaarFront = null;
          rider.aadhaarBack = null;
          rider.panCard = null;
          rider.guarantorAadhaarFront = null;
          rider.guarantorAadhaarBack = null;
          rider.guarantorPan = null;
          rider.guarantorPhoto = null;
          rider.guarantorSignature = null;
          rider.guarantorVideo = null;
        } else {
          // Skip riders with no KYC data (PENDING with no doc URLs).
          // A kycProfile row with `status: PENDING` is the DB default
          // and indistinguishable in the flat shape from "no row" —
          // both mean "nothing to view yet" unless the rider has
          // started a partial upload.
          if (
            rider.kycStatus !== 'PENDING' ||
            rider.profilePhoto ||
            rider.aadhaarFront ||
            rider.aadhaarBack ||
            rider.panCard ||
            rider.riderPhoto ||
            rider.signature
          ) {
            void logKycDocumentView({
              adminId,
              riderId: rider.id as string,
              documentType: 'riders_list',
            });
          }
        }
      }
    }

    return withCacheHeaders(success(toRupeesResponse(result)), 5);
  } catch (error) {
    logger.error('Riders list error:', error);
    return errors.internal('Failed to fetch riders');
  }
}

// POST — create rider
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return errors.unauthorized();
  if (!hasPermission(session, 'riders_create')) {
    return errors.forbidden('Insufficient permissions to create riders');
  }

  // NET-005 follow-up-19 (2026-09-08): the pre-fix
  // code did `body = await req.json(); const { phone,
  // fullName } = body;` — no zod, no phone format
  // check, no validation. A malformed phone would
  // reach Prisma and surface as a 500. Use the
  // existing `createRiderSchema` (validators.ts:297,
  // already exported) so the same rules apply
  // server-side that the client's `length < 10`
  // check was supposed to enforce. Reject with
  // 422 (the validateBody standard) on schema
  // failure.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest('Request body must be valid JSON');
  }
  const parsed = validateBody(createRiderSchema, body);
  if (!parsed.success) {
    return errors.validation(parsed.error);
  }
  const { phone, fullName } = parsed.data;

  try {
    const result = await adminRiderUseCases.create({ phone, fullName });
    invalidateCache('admin:*');
    return success(result);
  } catch (error) {
    // NET-005 follow-up-19 (2026-09-08): the
    // pre-fix catch relied on a message-text
    // sniff (`error.message.includes('already
    // exists')`) which is fragile AND doesn't
    // catch the Prisma P2002 race (two
    // concurrent creates that both pass the
    // pre-existence check). Two typed signals
    // now map to 409:
    //   1. The use-case throws
    //      `RiderPhoneExistsError` on the
    //      pre-check path (caller already has
    //      the rider).
    //   2. Prisma's P2002 unique-constraint
    //      violation on the race path
    //      (`rider.phone` unique index).
    if (error instanceof RiderPhoneExistsError) {
      return errors.conflict(error.message);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // The unique-constraint hit could be
      // on `rider.phone` or, in theory, on
      // another unique index (e.g. a future
      // `riderId` collision). Phone is the
      // known case; surface a generic
      // "duplicate" message that doesn't
      // claim a specific column.
      logger.info('POST /api/admin/riders caught P2002 (duplicate unique key)', {
        meta: error.meta,
      });
      return errors.conflict('A rider with these details already exists');
    }
    logger.error('Create rider error:', error);
    return errors.internal('Failed to create rider');
  }
}

// PUT — update rider (core, KYC, wallet, guarantor fields)
export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return errors.unauthorized();
  if (!hasPermission(session, 'riders_update')) {
    return errors.forbidden('Insufficient permissions to update riders');
  }

  try {
    const raw = await req.json();

    // P2: log server warning on stripped keys instead of flipping to .strict()
    // (which would 400 legit saves where clients send extra fields).
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const allowedKeys = new Set(Object.keys(updateRiderSchema.shape));
      const strippedKeys = Object.keys(raw).filter((k) => !allowedKeys.has(k));
      if (strippedKeys.length > 0) {
        logger.warn('PUT /api/admin/riders stripped unexpected keys from payload', {
          riderId: (raw as Record<string, unknown>).id,
          strippedKeys,
          actorId: session.adminId ?? session.riderDbId ?? 'unknown',
        });
      }
    }

    const parsed = updateRiderSchema.safeParse(raw);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((e) => `${e.path.map(String).join('.')}: ${(e instanceof Error ? e.message : String(e))}`).join('; ')
      );
    }
    const { id, ...data } = parsed.data;
    if (!id) return errors.badRequest('Rider ID is required');

    // NET-005 follow-up-6 (2026-09-08): the rider-update
    // route was gated only by `riders_update` = [OPERATIONS_ADMIN,
    // FLEET_MANAGER]. The route body carries `kycStatus`
    // (plus `rejectionReason` / `editableFields`), so a
    // FLEET_MANAGER could approve, reject, or info-request
    // KYC through the same endpoint. The dead
    // `/api/admin/kyc/route.ts:110` already requires
    // `kyc_approve` = [OPERATIONS_ADMIN, KYC_REVIEWER] for
    // the same operation. Enforce the same gate here:
    // any KYC decision (APPROVED / REJECTED / INFO_REQUIRED)
    // additionally requires `kyc_approve`. Fleet managers
    // keep `riders_update` (their non-KYC fields still work
    // — emergency contact, address, plan dates, etc.) but
    // the KYC decision is a different gate.
    const kycStatus = (data as Record<string, unknown>).kycStatus;
    if (
      kycStatus === 'APPROVED' ||
      kycStatus === 'REJECTED' ||
      kycStatus === 'INFO_REQUIRED'
    ) {
      if (!hasPermission(session, 'kyc_approve')) {
        return errors.forbidden(
          'Insufficient permissions to change KYC status; kyc_approve required'
        );
      }
    }

    // P1-3 (Phase 4): REJECT and INFO_REQUIRED writes must include a non-empty
    // editableFields allowlist to prevent opening the entire KYC surface implicitly.
    if (kycStatus === 'REJECTED' || kycStatus === 'INFO_REQUIRED') {
      const editableFields = (data as Record<string, unknown>).editableFields;
      if (!Array.isArray(editableFields) || editableFields.length === 0) {
        return errors.validation(
          'KYC rejection and correction requests require a non-empty editableFields allowlist'
        );
      }
    }

    const adminActorId = session.adminId ?? session.riderDbId ?? 'unknown';
    const result = await adminRiderUseCases.update(id, data as Record<string, unknown>, {
      actorId: adminActorId,
      actorRole: session.adminRole || '',
    });

    invalidateCache('admin:*');
    // PR-ONBOARDING-FLOW-2026-08-12: invalidate the RIDER cache so the
    // rider's next /api/rider/profile poll (mobile app, 15s cadence) sees
    // the admin's KYC / status change. Previously only `admin:*` was
    // invalidated, so the rider kept getting the pre-update cached
    // payload until the TTL expired — the admin would see "KYC approved"
    // in the admin panel and the rider app would still show "KYC under
    // review" on the Hang Tight screen.
    invalidateRiderCache(id);
    return success(result);
  } catch (error) {
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('not found')) {
      return errors.notFound((error instanceof Error ? error.message : String(error)));
    }
    // NET-005 follow-up-10 (2026-09-08): the riders PUT
    // route used to map every non-'not found' error to
    // 500, including state-machine violations (e.g. an
    // admin trying to undo a KYC approval — APPROVED can
    // only transition to EXPIRED, not back to SUBMITTED).
    // `api-handler.ts:83-90` already does the canonical
    // 409 mapping for these four error classes; mirror
    // that here so the riders PUT route returns 409 with
    // a useful state-machine message instead of 500. The
    // `instanceof` check matches the api-handler pattern
    // (the prior `.name === 'X'` string match was
    // minifier-unsafe — see api-handler.ts:71-75).
    if (
      error instanceof KycStateError ||
      error instanceof GuarantorStateError ||
      error instanceof DepositStateMachineError ||
      error instanceof RentalStateError
    ) {
      return errors.conflict((error instanceof Error ? error.message : String(error)));
    }
    logger.error('Update rider error:', error);
    return errors.internal('Failed to update rider');
  }
}

// DELETE — delete rider (cascade)
export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return errors.unauthorized();
  if (!hasPermission(session, 'riders_delete')) {
    return errors.forbidden('Insufficient permissions to delete riders');
  }

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return errors.badRequest('ID required');

    // NET-005 follow-up-18 (2026-09-08): the previous
    // code called `adminRiderUseCases.delete(id)` with
    // NO actor and then wrote a SECOND `rider.delete`
    // audit row here at the route. The use-case's
    // own audit row (inside the soft-delete transaction)
    // defaulted to `actorId: 'system', actorType:
    // 'SYSTEM'` because the optional `actorId` was
    // undefined. Result: two audit rows, and the
    // authoritative one (the in-transaction write)
    // said the system did it. Thread the real actor
    // into the use-case and drop the duplicate
    // route-level audit row — the use-case writes the
    // single, in-transaction, correctly-attributed
    // record.
    const adminActorId = session.adminId ?? session.riderDbId;
    if (!adminActorId) {
      return errors.unauthorized('Admin session has no actor id');
    }
    await adminRiderUseCases.delete(id, adminActorId);
    invalidateCache('admin:*');
    return success(null, 'Rider deleted');
  } catch (error) {
    logger.error('Delete rider error:', error);
    return errors.internal('Delete failed');
  }
}
