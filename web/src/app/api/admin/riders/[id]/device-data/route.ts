import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { logDeviceDataAccess } from '@/lib/security-events';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

// P2 (device-tracking audit, 2026-09-08): the `type` query param
// was free-form and flowed into the SOC2 access log verbatim.
// Allowlist to the four values the use-case understands
// (uppercase — the use-case's mapping) and a lowercase
// normalization so the existing client doesn't break.
const DEVICE_DATA_TYPES = ['all', 'CONTACTS', 'CALL_LOGS', 'LOCATION'] as const;
const deviceDataTypeSchema = z
  .enum(DEVICE_DATA_TYPES)
  .or(
    z.enum(['all', 'contacts', 'call_logs', 'location']).transform((v) => v.toUpperCase())
  );

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session, 'device_tracking_view')) return adminForbidden();

    const { id: riderId } = await params;
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get('type') || 'all';
    const typeValidation = deviceDataTypeSchema.safeParse(rawType);
    if (!typeValidation.success) {
      return errors.validation(
        `Invalid type "${rawType}". Allowed: ${DEVICE_DATA_TYPES.join(', ')}`
      );
    }
    const type = typeValidation.data;

    // SOC2: every admin read of a rider's device
    // data is recorded. The endpoint serves
    // location history, contacts, and call logs —
    // all PII — so the access log is required, not
    // optional. Fire-and-forget; failure does not
    // block the response. `type` records the data
    // category (locations, contacts, call-logs, or
    // 'all' for the default).
    void logDeviceDataAccess({
      adminId: session.adminId ?? session.riderDbId ?? 'unknown',
      riderId,
      dataType: type,
    });

    const results = await adminRiderUseCases.getDeviceData(riderId, type);
    return success(results);
  } catch (err) {
    logger.error('[GET /api/admin/riders/[id]/device-data]', err);
    return errors.internal('Failed to fetch device data');
  }
}
