/**
 * 9.5+ Hardening §7 (T-9P0-4) — payment gateway fail-closed.
 *
 * Before this fix, GET /api/rider/payment-gateways/active fabricated a
 *   {
 *     id: 'default_razorpay',
 *     provider: 'RAZORPAY',
 *     environment: 'TEST',
 *     keyId: null,
 *     ...
 *   }
 * object when no real gateway existed. That made it impossible for a
 * rider client to tell "the production gateway is real" from "the
 * server is silently returning a fake TEST gateway". The mobile app
 * would then try to use the bogus keyId and fail far away from the
 * actual cause.
 *
 * After this fix:
 *   - 200 + the real gateway fields when one is configured.
 *   - 503 + code: PAYMENT_GATEWAY_UNAVAILABLE when none is configured.
 *   - The 503 response carries NO `keyId`, NO `default_razorpay`, and
 *     NO `environment: TEST` payload.
 *
 * The dev DB has no seeded payment gateway, so the no-gateway branch
 * is the one we exercise here. The success-branch is covered by the
 * existing integration suite when an admin seeds a gateway.
 */
import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:8081';

async function api(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers as any) },
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('Security: payment gateway fail-closed (9.5+ T-9P0-4)', () => {
  it('returns 503 with PAYMENT_GATEWAY_UNAVAILABLE when no gateway is configured', async () => {
    const r = await api('/api/rider/payment-gateways/active');
    // In a configured environment this would be 200 + real gateway.
    // In the dev DB the table is empty, so we expect 503.
    if (r.status === 200) {
      // A real gateway IS configured in this environment — assert
      // it is a real, non-fabricated gateway (no default_razorpay,
      // no TEST environment unless the row explicitly says so).
      expect(r.body.success).toBe(true);
      const data = r.body.data;
      expect(data.id).not.toBe('default_razorpay');
      // The fabricated object had a hardcoded `environment: 'TEST'`
      // and a null keyId. A real production gateway has either a
      // production environment or a real test keyId — never both
      // null.
      if (data.environment === 'TEST') {
        expect(data.keyId).toBeTruthy();
      }
      return;
    }

    // No gateway → fail-closed branch.
    expect(r.status).toBe(503);
    expect(r.body.success).toBe(false);
    expect(r.body.error?.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');

    // No fabricated payload fields in the error response.
    const blob = JSON.stringify(r.body);
    expect(blob).not.toContain('default_razorpay');
    expect(blob).not.toContain('"environment":"TEST"');
    expect(blob).not.toContain('"environment": "TEST"');
    expect(blob).not.toContain('"keyId":null');
    expect(blob).not.toContain('"keyId": null');
  });
});
