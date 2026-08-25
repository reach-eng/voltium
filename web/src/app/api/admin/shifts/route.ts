import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';
import { logAdminMutation } from '@/lib/audit-log';

const shiftPartSchema = z.object({
  startTime: z.string().min(1, 'Start time required'),
  endTime: z.string().min(1, 'End time required'),
});

const shiftSchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  parts: z.array(shiftPartSchema).optional(),
  maxBookings: z.number().int().positive().default(5),
  isActive: z.boolean().default(true),
});

const deleteShiftSchema = z.object({ id: z.string().min(1) });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// PR-9 (2026-08-06 fix plan): `settings_manage` removed from the allowlist —
// shifts are an operations concern, not a settings concern.
//
// S-1 (W8): `ops_read` is a READ permission and must not grant write access.
// Split into two helpers:
//   canReadShifts  — includes ops_read (read-only callers can list shifts)
//   canMutateShifts — excludes ops_read (only proper write permissions)
function canReadShifts(session: any): boolean {
  const role = session?.adminRole || '';
  return (
    hasPermission(role, 'shifts_manage') ||
    hasPermission(role, 'ops_read') ||
    hasPermission(role, 'fleet_manage') ||
    hasPermission(role, 'hubs_manage')
  );
}

function canMutateShifts(session: any): boolean {
  const role = session?.adminRole || '';
  return (
    hasPermission(role, 'shifts_manage') ||
    hasPermission(role, 'fleet_manage') ||
    hasPermission(role, 'hubs_manage')
  );
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!canReadShifts(session)) return adminForbidden();
  try {
    const search = req.nextUrl.searchParams.get('search') || '';
    const activeOnly = req.nextUrl.searchParams.get('active') === 'true';
    const shifts = await shiftUseCases.listShifts(search, activeOnly);
    return withCacheHeaders(success(shifts), 0);
  } catch (error) {
    logger.error('GET /api/admin/shifts error:', error);
    return errors.internal('Failed to fetch shifts');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!canMutateShifts(session)) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(shiftSchema, body);
    if (!validation.success) return errors.validation(validation.error!);
    const shift = await shiftUseCases.createShift(validation.data, session.adminId || '');

    await logAdminMutation({
      session,
      action: 'shift.create',
      entity: 'Shift',
      entityId: (shift as any)?.id || validation.data.name,
      details: validation.data,
    });

    return success(shift, 'Shift created', 201);
  } catch (error) {
    logger.error('POST /api/admin/shifts error:', error);
    return errors.internal('Failed to create shift');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!canMutateShifts(session)) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(shiftSchema.partial().extend({ id: z.string().min(1) }), body);
    if (!validation.success) return errors.validation(validation.error!);
    const { id, ...data } = validation.data;
    const shift = await shiftUseCases.updateShift(id, data, session.adminId || '');

    await logAdminMutation({
      session,
      action: 'shift.update',
      entity: 'Shift',
      entityId: id,
      details: data,
    });

    return success(shift);
  } catch (error) {
    logger.error('PUT /api/admin/shifts error:', error);
    return errors.internal('Failed to update shift');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!canMutateShifts(session)) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(deleteShiftSchema, body);
    if (!validation.success) return errors.validation(validation.error!);
    const { id } = validation.data;
    await shiftUseCases.deleteShift(id, session.adminId || '');

    await logAdminMutation({
      session,
      action: 'shift.delete',
      entity: 'Shift',
      entityId: id,
    });

    return success(null, 'Shift archived');
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (message.includes('Cannot delete shift')) {
      return errors.conflict(message);
    }
    logger.error('DELETE /api/admin/shifts error:', error);
    return errors.internal('Failed to delete shift');
  }
}
