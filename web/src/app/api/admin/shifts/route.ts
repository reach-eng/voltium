import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';

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

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();
  try {
    const search = req.nextUrl.searchParams.get('search') || '';
    const activeOnly = req.nextUrl.searchParams.get('active') === 'true';
    const shifts = await shiftUseCases.listShifts(search, activeOnly);
    return success(shifts);
  } catch (error) {
    logger.error('GET /api/admin/shifts error:', error);
    return errors.internal('Failed to fetch shifts');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(shiftSchema, body);
    if (!validation.success) return errors.validation(validation.error!);
    const shift = await shiftUseCases.createShift(validation.data, session.adminId || '');
    return success(shift, 'Shift created', 201);
  } catch (error) {
    logger.error('POST /api/admin/shifts error:', error);
    return errors.internal('Failed to create shift');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(shiftSchema.partial().extend({ id: z.string().min(1) }), body);
    if (!validation.success) return errors.validation(validation.error!);
    const { id, ...data } = validation.data;
    const shift = await shiftUseCases.updateShift(id, data, session.adminId || '');
    return success(shift);
  } catch (error) {
    logger.error('PUT /api/admin/shifts error:', error);
    return errors.internal('Failed to update shift');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(deleteShiftSchema, body);
    if (!validation.success) return errors.validation(validation.error!);
    const { id } = validation.data;
    await shiftUseCases.deleteShift(id, session.adminId || '');
    return success(null, 'Shift deleted');
  } catch (error: any) {
    if (error?.message?.includes?.('Cannot delete shift')) {
      return errors.conflict(error.message);
    }
    logger.error('DELETE /api/admin/shifts error:', error);
    return errors.internal('Failed to delete shift');
  }
}
