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
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

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
  // KYC fields
  kycStatus: z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED']).optional(),
  profilePhoto: z.string().url().optional().or(z.literal('')),
  riderPhoto: z.string().url().optional().or(z.literal('')),
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
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '20'));
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortDir = url.searchParams.get('sortDir') || 'desc';

    const result = await adminRiderUseCases.list({
      search,
      state,
      kycStatus,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortDir,
    });

    return success(result);
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
    return success(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return errors.conflict(error.message);
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
        parsed.error.issues.map((e) => `${e.path.map(String).join('.')}: ${e.message}`).join('; ')
      );
    }
    const { id, ...data } = parsed.data;
    if (!id) return errors.badRequest('Rider ID is required');

    const adminActorId = session.adminId ?? session.riderDbId ?? 'unknown';
    const result = await adminRiderUseCases.update(id, data as Record<string, unknown>, {
      actorId: adminActorId,
      actorRole: session.adminRole || '',
    });

    return success(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errors.notFound(error.message);
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
    return success(null, 'Rider deleted');
  } catch (error) {
    logger.error('Delete rider error:', error);
    return errors.internal('Delete failed');
  }
}
