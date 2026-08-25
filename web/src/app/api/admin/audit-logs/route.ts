import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import { redactPii } from '@/lib/pii-redact';
import { parsePositiveInt } from '@/lib/api-utils';

/**
 * P2-6/P2-7 (2026-08-05 ops audit): `log.details` is a JSON string, but a
 * malformed row (hand-written migration, partial write, legacy format) used to
 * throw inside JSON.parse and take the whole endpoint down with a 500 — the
 * audit log became inaccessible on the first bad entry. Non-JSON content is
 * returned as-is (it still goes through redactPii).
 */
function parseDetails(details: string | null): unknown {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return details;
  }
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  // P0-2 (2026-08-05 ops audit): the route only required *any* admin — a
  // READ_ONLY admin could enumerate every actor, their work hours, the
  // riders they touch (entityId), and financial events. audit_view is
  // granted to ops/finance roles only (READ_ONLY removed from the matrix).
  if (!hasPermission(session, 'audit_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    // P2-5: the repository supports entity/entityId filters but the route
    // never exposed them — SOC2 reviews couldn't isolate one rider's trail.
    const entity = url.searchParams.get('entity') || undefined;
    const entityId = url.searchParams.get('entityId') || undefined;
    const actorId = url.searchParams.get('actorId') || undefined;
    const action = url.searchParams.get('action') || undefined;
    const actionPrefix = url.searchParams.get('actionPrefix') || undefined;
    const q = url.searchParams.get('q') || undefined;
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    // PR-4b (13th audit P0-6): NaN-safe pagination.
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 100);

    const result = await adminUseCases.getAuditLogs({
      entity,
      entityId,
      actorId,
      action,
      actionPrefix,
      q,
      from,
      to,
      page,
      limit,
    });

    // PR-153: PII redaction. AuditLog.details is a JSON string that
    // can contain phone numbers, Aadhaar/PAN/account numbers, emails,
    // and riderId — all PII under GDPR/DPDP. The `redactPii` pass
    // walks the parsed JSON and replaces any value whose key matches
    // the SENSITIVE_KEYS set (aadhaar, pan, phone, email, password,
    // secret, token, etc.) with `[REDACTED]`. It also matches values
    // that look like JWTs, base64 secrets, or long hex strings.
    //
    // The actorId/actorType fields at the top level are NOT redacted
    // — those are admin identifiers (usernames), not rider PII. The
    // PII lives in `details`.
    const redactedLogs = result.logs.map((log: any) => ({
      ...log,
      details: redactPii(parseDetails(log.details)),
      // P1-5: entityId is a key into rider PII (and occasionally a raw phone
      // for legacy rows) — run it through the same redaction pass. Values
      // that look like tokens/phones get masked; ordinary UUIDs pass through
      // so the admin UI filter keeps working.
      entityId: log.entityId ? redactPii(log.entityId) : null,
    }));

    return success(redactedLogs, undefined, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    // P1-7: the raw Prisma error can embed the actorId (which is a phone for
    // rider actions) — log the redacted form, never the raw error.
    logger.error('[AUDIT_LOGS_GET]', redactPii(error));
    return errors.internal('Failed to fetch audit logs');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  try {
    const body = await req.json();
    const { action, entity, entityId, details } = body;

    if (!action || typeof action !== 'string' || !entity || typeof entity !== 'string') {
      return errors.badRequest('action and entity strings are required');
    }

    const { logAdminMutation } = await import('@/lib/audit-log');
    await logAdminMutation({
      session,
      action,
      entity,
      entityId: typeof entityId === 'string' ? entityId : undefined,
      details: typeof details === 'object' || typeof details === 'string' ? details : undefined,
    });

    return success(null, 'Audit log recorded', 201);
  } catch (error) {
    logger.error('[AUDIT_LOGS_POST]', redactPii(error));
    return errors.internal('Failed to record audit log');
  }
}
