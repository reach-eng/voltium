import { KycStatus, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { requireAdmin, adminUnauthorized, adminForbidden, adminForbiddenWithLog } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { parsePositiveInt } from '@/lib/api-utils';
import { kycRepository } from '@/server/modules/kyc/kyc.repository';
import { kycUseCases } from '@/server/modules/kyc/kyc.use-cases';
import { approveKyc } from '@/server/modules/kyc/use-cases/approveKyc';
import { KycApproveError } from '@/server/modules/kyc/use-cases/errors';
import { withApiHandler } from '@/lib/api-handler';
import { signRiderUrls } from '@/lib/sign-rider';
import { logKycDocumentView } from '@/lib/security-events';

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'kyc_view')) {
    return adminForbiddenWithLog({
      session,
      permission: 'kyc_view',
      route: '/api/admin/kyc',
      ip: request.headers.get('x-forwarded-for') || undefined,
    });
  }

  const url = request.nextUrl;
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const page = parsePositiveInt(url.searchParams.get('page'), 1);
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

  const where: Prisma.KycProfileWhereInput = {};
  if (status && status !== 'ALL' && status in KycStatus) {
    where.status = status as KycStatus;
  }
  if (search) {
    where.rider = {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { riderId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    };
  }

  // KYC review queue refreshes every 5s on the page; cache the filtered list at
  // the route level so different admins with different filters don't poison
  // each other's caches, and the search query is part of the key. Approve /
  // reject handlers below invalidate the admin:* namespace.
  const cacheKey = [
    'admin:kyc',
    session.adminId ?? 'anon',
    status ?? '',
    search ?? '',
    page,
    limit,
  ].join(':');

  const result = await getOrSetResponse(
    cacheKey,
    async () => {
      const [records, total] = await Promise.all([
        kycRepository.findMany({
          where,
          include: {
            rider: {
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
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        kycRepository.count({ where }),
      ]);
      // PR-ONBOARDING-2026-08-11 (audit 2.8): sign photo URLs so the admin
      // browser can actually load them. Without this, public buckets leak
      // and private buckets show broken images. `signRiderUrls` no-ops on
      // missing fields, so it's safe across the schema.
      const signed = await Promise.all(
        records.map((r) => signRiderUrls(r as unknown as Record<string, unknown>))
      );
      return {
        records: signed,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    },
    5
  );

  // NET-005 follow-up-9 (2026-09-08): the KYC review queue
  // returns each rider's full kycProfile (all doc URLs,
  // signed). SOC2 requires per-admin-view logging. The dead
  // `findByRiderIdForAdmin` was never wired up; we fire
  // the per-record log here, after the cache resolves,
  // so it covers every GET (not just cache misses). The
  // 5s `getOrSetResponse` TTL bounds the volume. The kyc
  // include is preserved through `signRiderUrls` (it only
  // rewrites URL fields), so `record.rider?.id` is intact.
  // documentType=`kyc_queue` distinguishes this from the
  // list and detail views.
  if (result && Array.isArray((result as { records?: unknown[] }).records)) {
    const adminId = session.adminId ?? 'unknown';
    for (const record of (result as { records: Array<{ rider?: { id: string } | null }> }).records) {
      if (record.rider?.id) {
        void logKycDocumentView({
          adminId,
          riderId: record.rider.id,
          documentType: 'kyc_queue',
        });
      }
    }
  }

  return withCacheHeaders(success(result), 5);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'kyc_approve')) return adminForbidden();

  const body = await request.json();
  const riderId = body.riderId || body.riderDbId;
  const action = String(body.action || body.decision || '').toUpperCase();
  if (!riderId || !action) return errors.badRequest('riderId and action are required');

  // NET-005 follow-up-14 (2026-09-08): validate the
  // action against the canonical set BEFORE
  // dispatching. The pre-fix code accepted any
  // string and routed unknown actions into the
  // `else` branch which called `reviewKyc(riderId,
  // adminId, {action: 'FROBNICATE' as any, ...})`,
  // surfacing the state-machine error as 409 (an
  // "invalid transition" message that suggests a
  // real state issue, not a typo). Validate up
  // front so the API returns a clear 400 for
  // typos and unknown actions.
  const ALLOWED_KYC_ACTIONS = new Set(['APPROVE', 'REJECT', 'REQUEST_INFO', 'REOPEN']);
  if (!ALLOWED_KYC_ACTIONS.has(action)) {
    return errors.badRequest(
      `action must be one of: ${Array.from(ALLOWED_KYC_ACTIONS).join(', ')}`
    );
  }

  // P1-3 (Phase 4): REJECT and REQUEST_INFO writes must include a non-empty
  // editableFields allowlist to prevent opening the entire KYC surface implicitly.
  if (action === 'REJECT' || action === 'REQUEST_INFO') {
    if (!Array.isArray(body.editableFields) || body.editableFields.length === 0) {
      return errors.validation(
        'KYC rejection and correction requests require a non-empty editableFields allowlist'
      );
    }
  }

  // PR-26b: route APPROVE through the dedicated `approveKyc` use case so the
  // cross-entity invariants (KYC must be SUBMITTED) and audit log are
  // enforced in one place. REJECT and REQUEST_INFO still go through the
  // shared `kycUseCases.reviewKyc` path.
  //
  // NET-005 follow-up-13 (2026-09-08): add a REOPEN
  // action for the admin "Re-verify" button. Routes an
  // EXPIRED profile back to PENDING (via the new state
  // machine transition EXPIRED → PENDING +
  // `kycRepository.reopenExpiredKyc`). The state machine
  // throws `KycStateError` for any source status other
  // than EXPIRED; the canonical 409 mapping in
  // `withApiHandler` (api-handler.ts:83-90) handles it
  // — `KycStateError` is one of the four domain errors
  // mapped to 409 there. This action re-uses the same
  // `kyc_approve` permission gate as APPROVE/REJECT.
  let result;
  if (action === 'APPROVE') {
    try {
      result = await approveKyc(riderId, session.adminId || '');
    } catch (err) {
      if (err instanceof KycApproveError) {
        return errors.badRequest(err.message);
      }
      throw err;
    }
  } else if (action === 'REOPEN') {
    result = await kycUseCases.reopenExpiredKyc(riderId, session.adminId || '');
  } else {
    result = await kycUseCases.reviewKyc(riderId, session.adminId || '', {
      reviewerId: session.adminId || '',
      action: action as any,
      rejectionReason: body.rejectionReason || body.reason,
      infoRequest: body.infoRequest || body.message,
      editableFields: body.editableFields,
    });
  }

  // Approve / reject changes the KYC queue — clear cached lists so the next GET
  // reflects the new status instead of waiting up to 5s for the TTL to expire.
  invalidateCache('admin:kyc:*');

  return success(result, `KYC ${String(action).toLowerCase()} processed`);
});
