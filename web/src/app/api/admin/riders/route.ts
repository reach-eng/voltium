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
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

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
      search, state, kycStatus, startDate, endDate, page, limit, sortBy, sortDir,
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
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return errors.badRequest('Rider ID is required');

    const adminActorId = session.adminId ?? session.riderDbId ?? 'unknown';
    const result = await adminRiderUseCases.update(id, data, {
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
