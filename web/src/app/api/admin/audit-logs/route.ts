import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import { redactPii, maskPhoneLike } from '@/lib/pii-redact';
import { parsePositiveInt } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

const AUDIT_READ_LIMIT = { windowMs: 60_000, maxRequests: 60 };
const AUDIT_WRITE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

async function checkAuditRateLimit(adminId: string, config: typeof AUDIT_READ_LIMIT) {
  // The dashboard polls audit-logs every 30s; cap per admin so a hot
  // loop can't fan out. Fail-open: reads/writes stay available during
  // a limiter outage.
  const rl = await checkRateLimit(`admin:audit:${adminId}`, config);
  if (!rl.allowed) {
    return errors.tooManyRequests('Too many requests. Please try again later.', {
      rateLimit: { limit: config.maxRequests, remaining: rl.remaining, resetAt: rl.resetAt },
    });
  }
  return null;
}

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

  const limited = await checkAuditRateLimit(session.adminId || 'unknown', AUDIT_READ_LIMIT);
  if (limited) return limited;

  try {
    const url = req.nextUrl;
    // P2-5: the repository supports entity/entityId filters but the route
    // never exposed them — SOC2 reviews couldn't isolate one rider's trail.
    const entity = url.searchParams.get('entity') || undefined;
    const entityId = url.searchParams.get('entityId') || undefined;
    const actorId = url.searchParams.get('actorId') || undefined;
    const action = url.searchParams.get('action') || undefined;
    // PR-4b (13th audit P0-6): NaN-safe pagination.
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 100);

    const result = await adminUseCases.getAuditLogs({ entity, entityId, actorId, action, page, limit });

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
      // P1: redactPii(string) ignores 10-digit phones — mask phone-like
      // entityIds explicitly (legacy rows use raw phones). Ordinary UUIDs
      // pass through so the admin UI filter keeps working.
      entityId: log.entityId ? maskPhoneLike(redactPii(log.entityId)) : null,
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

/**
 * The POST previously let ANY admin write arbitrary
 * `action`/`entity`/`details` rows — audit forgery. Now gated on
 * `audit_view` (same as GET) with an allowlisted action set; the only
 * known client use is the KYC PII-reveal log.
 */
const ALLOWED_AUDIT_POST_ACTIONS = new Set(['admin.kyc_pii_revealed', 'kyc.export']);

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  const limited = await checkAuditRateLimit(session.adminId || 'unknown', AUDIT_WRITE_LIMIT);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const { riderId, action = 'admin.kyc_pii_revealed', details } = body;

    if (!ALLOWED_AUDIT_POST_ACTIONS.has(action)) {
      return errors.validation(`action must be one of: ${[...ALLOWED_AUDIT_POST_ACTIONS].join(', ')}`);
    }

    const isKycAction = action === 'kyc.export' || action === 'admin.kyc_pii_revealed';
    const hasAuth = isKycAction
      ? hasPermission(session, 'kyc_view') || hasPermission(session, 'audit_view')
      : hasPermission(session, 'audit_view');
    if (!hasAuth) return adminForbidden();

    const effectiveRiderId =
      typeof riderId === 'string' && riderId.trim().length > 0
        ? riderId.trim()
        : action === 'kyc.export'
        ? 'export'
        : '';

    if (!effectiveRiderId || effectiveRiderId.length > 100) {
      return errors.validation('riderId is required and must be at most 100 characters');
    }

    const { createAuditLog } = await import('@/lib/audit-log');
    const log = await createAuditLog({
      actorId: session.adminId || 'unknown',
      actorType: 'ADMIN',
      action,
      entity: action.startsWith('kyc.') ? 'kyc' : 'Rider',
      entityId: effectiveRiderId,
      details: details && typeof details === 'object' ? details : {},
    });

    return success({ log });
  } catch (error) {
    logger.error('[AUDIT_LOGS_POST]', redactPii(error));
    return errors.internal('Failed to record audit log');
  }
}

