import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, createPlanSchema, updatePlanSchema, deletePlanSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden, parsePaginationParams } from '@/lib/rbac';
import { hasPermission, type Permission } from '@/lib/auth';
import { planUseCases } from '@/server/modules/plans/plan.use-cases';

const PERM_MAP: Record<string, Permission> = { view: 'analytics_view', create: 'plans_manage', update: 'plans_manage', delete: 'plans_manage' };

function checkPlansPermission(session: any, action: 'view' | 'create' | 'update' | 'delete'): boolean {
  return hasPermission(session.adminRole || '', PERM_MAP[action]);
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!checkPlansPermission(session, 'view')) return adminForbidden();

  try {
    const { page, limit } = parsePaginationParams(req.nextUrl);
    const result = await planUseCases.list(page, limit);
    return success(result.plans, undefined, 200, result.pagination);
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
    logger.error('Delete plan error:', error);
    return errors.internal('Failed to delete plan');
  }
}
