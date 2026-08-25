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
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { parseDDMMYYYY } from '@/lib/date-utils';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { invalidateRiderCache } from '@/lib/server-cache';
import { createAuditLog, logAdminMutation } from '@/lib/audit-log';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';
import { toRupeesResponse } from '@/lib/api-money';

/**
 * Allowlisted update schema — prevents mass assignment by only accepting
 * explicitly declared fields with their correct types.
 */
const updateRiderSchema = z.object({
  id: z.string().min(1),
  // Core rider fields
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  fatherName: z.string().max(100).optional(),
  motherName: z.string().max(100).optional(),
  dob: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/)
    .optional(),
  currentAddress: z.string().max(500).optional(),
  emergencyContact: z.string().max(20).optional(),
  pickupHub: z.string().max(100).optional(),
  teamLeader: z.string().max(100).optional(),
  planStartDate: z.string().datetime().optional().or(z.literal('')),
  planEndDate: z.string().datetime().optional().or(z.literal('')),
  intent: z.enum(['deliver', 'personal']).optional(),
  referralCode: z.string().max(20).optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  preferredShift: z.string().max(50).optional(),
  referredBy: z.string().max(100).optional(),
  assignedVehicle: z.string().max(100).optional().nullable(),
  vehicleId: z.string().max(100).optional().nullable(),
  currentPlan: z.string().max(100).optional().nullable(),
  pickedUpAt: z.string().datetime().optional().nullable().or(z.literal('')),
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
    .optional(),
  registrationDone: z.boolean().optional(),
  depositDone: z.boolean().optional(),
  kycDone: z.boolean().optional(),
  planDone: z.boolean().optional(),
  pickupDone: z.boolean().optional(),
  // KYC fields
  kycStatus: z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED']).optional(),
  profilePhoto: z.string().url().optional().or(z.literal('')),
  riderPhoto: z.string().url().optional().or(z.literal('')),
  riderVideo: z.string().url().optional().or(z.literal('')),
  signature: z.string().url().optional().or(z.literal('')),
  aadhaarFront: z.string().url().optional().or(z.literal('')),
  aadhaarBack: z.string().url().optional().or(z.literal('')),
  aadhaarNumber: z.string().max(12).optional(),
  panCard: z.string().url().optional().or(z.literal('')),
  panNumber: z.string().max(10).optional(),
  bankAccount: z.string().max(30).optional(),
  bankIfsc: z.string().max(11).optional(),
  bankName: z.string().max(100).optional(),
  accountNumber: z.string().max(30).optional(),
  ifscCode: z.string().max(11).optional(),
  rejectionReason: z.string().max(500).optional(),
  editableFields: z.array(z.string()).optional(),
  // Wallet fields
  walletBalance: z.number().optional(),
  // Guarantor fields
  guarantorStatus: z
    .enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED'])
    .optional(),
  guarantorName: z.string().max(100).optional(),
  guarantorRelation: z.string().max(50).optional(),
  guarantorPhone: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
  guarantorDob: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/)
    .optional(),
  guarantorAadhaarFront: z.string().url().optional().or(z.literal('')),
  guarantorAadhaarBack: z.string().url().optional().or(z.literal('')),
  guarantorPan: z.string().url().optional().or(z.literal('')),
  guarantorVideo: z.string().url().optional().or(z.literal('')),
  guarantorSignature: z.string().url().optional().or(z.literal('')),
  guarantorFatherName: z.string().max(100).optional(),
  guarantorMotherName: z.string().max(100).optional(),
  guarantorAddress: z.string().max(500).optional(),
  guarantorPhoto: z.string().url().optional().or(z.literal('')),
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
    const startDateRaw = url.searchParams.get('startDate') || '';
    const endDateRaw = url.searchParams.get('endDate') || '';
    const startDate = startDateRaw
      ? parseDDMMYYYY(startDateRaw)?.toISOString() || startDateRaw
      : '';
    const endDate = endDateRaw
      ? parseDDMMYYYY(endDateRaw)?.toISOString() || endDateRaw
      : '';
    const hubId = url.searchParams.get('hubId') || '';
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
      hubId,
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
        hubId: hubId || undefined,
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

  try {
    const body = await req.json();
    const { phone, fullName } = body;

    const result = await adminRiderUseCases.create({ phone, fullName });
    invalidateCache('admin:riders:*');
    await logAdminMutation({
      session,
      action: 'rider.create',
      entity: 'Rider',
      entityId: result?.id,
      details: { phone, fullName },
    });
    return success(result);
  } catch (error) {
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('already exists')) {
      return errors.conflict((error instanceof Error ? error.message : String(error)));
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
    const parsed = updateRiderSchema.safeParse(raw);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((e) => `${e.path.map(String).join('.')}: ${(e instanceof Error ? e.message : String(e))}`).join('; ')
      );
    }
    const { id, ...data } = parsed.data;
    if (!id) return errors.badRequest('Rider ID is required');

    const adminActorId = session.adminId ?? session.riderDbId ?? 'unknown';
    const result = await adminRiderUseCases.update(id, data as Record<string, unknown>, {
      actorId: adminActorId,
      actorRole: session.adminRole || '',
    });

    invalidateCache('admin:riders:*');
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

    await adminRiderUseCases.delete(id);
    createAuditLog({
      actorId: session.adminId || session.riderDbId || 'system',
      action: 'rider.delete',
      entity: 'rider',
      entityId: id,
    }).catch((e: unknown) => logger.error('Audit log failed for rider delete', e));
    invalidateCache('admin:riders:*');
    return success(null, 'Rider deleted');
  } catch (error) {
    logger.error('Delete rider error:', error);
    return errors.internal('Delete failed');
  }
}
