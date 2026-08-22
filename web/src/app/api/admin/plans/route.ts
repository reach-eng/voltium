import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import {
  validateBody,
  createPlanSchema,
  updatePlanSchema,
  deletePlanSchema,
} from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { parsePositiveInt } from '@/lib/api-utils';
import { hasPermission, type Permission } from '@/lib/auth';
import { planUseCases } from '@/server/modules/plans/plan.use-cases';

// P1.10 (2026-08-05 rentals/vehicles/hubs audit): plan GET gated on
// `analytics_view` — READ_ONLY admins have plans_view but NOT analytics_view,
// so they were locked out of a screen their role permits.
const PERM_MAP: Record<string, Permission> = {
  view: 'plans_view',
  create: 'plans_manage',
  update: 'plans_manage',
  delete: 'plans_manage',
};

function checkPlansPermission(
  session: any,
  action: 'view' | 'create' | 'update' | 'delete'
): boolean {
  return hasPermission(session, PERM_MAP[action]);
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkPlansPermission(session, 'view')) return adminForbidden();

  try {
    // DEEP-AUDIT D-P1-1: parsePositiveInt from api-utils, not the removed
    // parsePaginationParams in rbac.ts (which returned NaN for ?page=abc).
    const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1);
    const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 20, 100);
    const search = req.nextUrl.searchParams.get('search');
    const result = await planUseCases.list(page, limit, search);
    return withCacheHeaders(success(result.plans, undefined, 200, result.pagination), 300);
  } catch (error) {
    logger.error('Plans list error:', error);
    return errors.internal('Failed to fetch plans');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkPlansPermission(session, 'create')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createPlanSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const plan = await planUseCases.create(validation.data, session.adminId || '');
    return success(plan, 'Plan created', 201);
  } catch (error) {
    logger.error('Create plan error:', error);
    return errors.internal('Failed to create plan');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkPlansPermission(session, 'update')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updatePlanSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { id, ...data } = validation.data;
    const plan = await planUseCases.update(id, data, session.adminId || '');
    return success(plan);
  } catch (error) {
    logger.error('Update plan error:', error);
    return errors.internal('Failed to update plan');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkPlansPermission(session, 'delete')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(deletePlanSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    await planUseCases.delete(validation.data.id, session.adminId || '');
    return success(null, 'Plan deleted');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Delete plan error:', error);
    return errors.internal(`Failed to delete plan: ${msg}`);
  }
}
