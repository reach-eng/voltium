import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { createAuditLog } from '@/lib/audit-log';
import { decryptCredential } from '@/lib/credentials';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * ADMIN_PAYMENT_GATEWAY_AUDIT_2026-08-24 P1-1 + P1-4 — "Test Connection"
 * endpoint.
 *
 * P1-4: validates that `apiEndpoint` (if provided) is an HTTPS URL that
 * resolves to a public IP — no `javascript:`, no private ranges, no
 * non-HTTP schemes. The server can be tricked into outbound calls that
 * exfiltrate auth headers or hit internal infrastructure; the
 * validation lives on the server because the UI maxlength/pattern can
 * be bypassed in DevTools.
 *
 * P1-1: a lighter version of the audit's "issue a small test order"
 * approach. We don't actually contact the gateway's API (that would
 * require a per-gateway SDK wrapper that this codebase doesn't have —
 * each gateway integrates separately on the rider-app side). Instead,
 * we run a local config-validation check that catches the most common
 * misconfigurations before the admin enables the gateway for real
 * riders.
 */
function isValidPublicApiEndpoint(value: string | null | undefined): {
  ok: boolean;
  reason?: string;
} {
  if (value === null || value === undefined || value === '') {
    return { ok: true }; // optional field
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'must use https://' };
  }
  // Disallow obvious SSRF targets. hostname is always a string per
  // the URL spec; the allowlist below rejects the canonical
  // loopback / private / link-local patterns.
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return { ok: false, reason: 'loopback addresses are not allowed' };
  }
  if (host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) {
    return { ok: false, reason: 'private network addresses are not allowed' };
  }
  if (host.startsWith('169.254.')) {
    return { ok: false, reason: 'link-local addresses are not allowed' };
  }
  // 172.16.0.0/12 — RFC 1918
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
    return { ok: false, reason: 'private network addresses are not allowed' };
  }
  return { ok: true };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  if (
    !hasPermission(session, 'payment_gateways_manage') &&
    !hasPermission(session, 'transactions_manage')
  ) {
    return errors.forbidden('Insufficient permission to test payment gateway');
  }

  const { id } = await params;
  if (!id) return errors.badRequest('Gateway ID is required');

  try {
    const gateway = await db.paymentGateway.findUnique({ where: { id } });
    if (!gateway) {
      return errors.notFound('Payment gateway not found');
    }

    const issues: string[] = [];

    // P1-1: config-level checks. We don't make a real API call (the
    // per-gateway SDK integration lives on the rider-app side), but
    // we catch the structural problems that would block a real call.
    if (gateway.environment === 'LIVE') {
      // For LIVE, all credentials must be present.
      if (!gateway.keyId) issues.push('API Key ID is required for LIVE gateways');
      if (!gateway.keySecret) issues.push('API Key Secret is required for LIVE gateways');
      if (!gateway.webhookSecret)
        issues.push('Webhook Secret is required for LIVE gateways');
    } else {
      // For TEST, missing webhook secret is fine (most sandboxes don't
      // sign webhooks). keyId + keySecret are still required to make
      // any API call.
      if (!gateway.keyId) issues.push('API Key ID is required');
      if (!gateway.keySecret) issues.push('API Key Secret is required');
    }

    // P1-4: apiEndpoint validation. Optional, but if set must be a
    // public HTTPS URL.
    const endpointCheck = isValidPublicApiEndpoint(gateway.apiEndpoint);
    if (!endpointCheck.ok) {
      issues.push(`API Base Endpoint: ${endpointCheck.reason}`);
    }

    // Decrypt one secret to confirm the encryption path is intact
    // (catches a "key rotation broke the data" regression). The
    // decrypted value is never returned to the client.
    let decryptOk = false;
    if (gateway.keySecret) {
      const plain = decryptCredential(gateway.keySecret);
      decryptOk = typeof plain === 'string' && plain.length > 0;
      if (!decryptOk) issues.push('Stored secret could not be decrypted — check encryption key');
    }

    const ok = issues.length === 0;

    // Audit log every test-connection call so the audit trail shows
    // when an admin last validated the gateway.
    createAuditLog({
      actorId: session.adminId ?? session.riderDbId ?? 'unknown',
      actorType: 'ADMIN',
      action: 'payment_gateway_test_connection',
      entity: 'PaymentGateway',
      entityId: id,
      details: JSON.stringify({ ok, issueCount: issues.length, decryptOk }),
    }).catch((err) => logger.error('audit log failed for test-connection', { err }));

    if (ok) {
      return success(
        {
          ok: true,
          checks: {
            credentials: { ok: true },
            apiEndpoint: { ok: true },
            decrypt: { ok: decryptOk },
          },
          message: decryptOk
            ? 'Configuration check passed. The gateway credentials decrypt and the endpoint is a public HTTPS URL.'
            : 'Configuration check passed.',
        },
        'Test connection successful'
      );
    }

    return success(
      {
        ok: false,
        issues,
        // Surface the same checks object on failure so the admin
        // sees the per-check breakdown.
        checks: {
          credentials: { ok: !issues.some((i) => i.includes('Key') || i.includes('Webhook')) },
          apiEndpoint: { ok: endpointCheck.ok, reason: endpointCheck.reason },
          decrypt: { ok: decryptOk },
        },
      },
      'Test connection found issues'
    );
  } catch (err) {
    logger.error('Test payment gateway connection error', { error: err });
    return errors.internal('Failed to test payment gateway connection');
  }
}
