import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, createOfferSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { parsePositiveInt } from '@/lib/api-utils';
import { hasPermission } from '@/lib/auth';
import { offerUseCases } from '@/server/modules/offers/offer.use-cases';

const deleteOfferSchema = z.object({ id: z.string().min(1) });

function checkOfferPermission(session: any): boolean {
  return hasPermission(session, 'offers_manage');
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkOfferPermission(session)) return adminForbidden();

  try {
    // DEEP-AUDIT D-P1-1: parsePositiveInt (NaN-safe) replaces the removed
    // parsePaginationParams helper.
    const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1);
    const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 20, 100);
    const search = req.nextUrl.searchParams.get('search');
    const result = await offerUseCases.listAdmin(page, limit, search);
    return withCacheHeaders(success(result.offers, undefined, 200, result.pagination), 60);
  } catch (error) {
    logger.error('GET /api/admin/offers error:', error);
    return errors.internal('Failed to fetch offers');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkOfferPermission(session)) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createOfferSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const offer = await offerUseCases.create(validation.data, session.adminId || '');
    return success(offer, 'Offer created', 201);
  } catch (error) {
    logger.error('POST /api/admin/offers error:', error);
    return errors.internal('Failed to create offer');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkOfferPermission(session)) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(
      createOfferSchema.partial().extend({ id: z.string().min(1) }),
      body
    );
    if (!validation.success) return errors.validation(validation.error!);

    const { id, ...data } = validation.data;
    const offer = await offerUseCases.update(id, data, session.adminId || '');
    return success(offer);
  } catch (error) {
    logger.error('PUT /api/admin/offers error:', error);
    return errors.internal('Failed to update offer');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkOfferPermission(session)) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(deleteOfferSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    await offerUseCases.delete(validation.data.id, session.adminId || '');
    return success(null, 'Offer deleted');
  } catch (error) {
    logger.error('DELETE /api/admin/offers error:', error);
    return errors.internal('Failed to delete offer');
  }
}
