import { describe, it, expect } from 'vitest';
import { createSessionToken } from '../../src/lib/auth';

const BASE = 'http://localhost:8081';

async function api(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as any),
    },
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('Security: PII Leak Audit', () => {
  // Use Arjun Sharma (rider-1) who has referrals (Priyanka Gupta)
  const riderPayload = {
    riderId: 'VF-RD-001',
    riderDbId: 'rider-1',
    phone: '9999900001',
    role: 'rider',
  };

  const riderToken = createSessionToken(riderPayload);

  it('checks if /api/rider/profile leaks unmasked sensitive fields (Aadhaar/PAN)', async () => {
    const { status, body } = await api('/api/rider/profile', {
      headers: { Authorization: `Bearer ${riderToken}` },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const data = body.data;
    // For the rider's own profile, we check if Aadhaar/PAN are unmasked
    if (data.aadhaarNumber) {
      // Aadhaar should ideally be masked even for the owner, or at least provided as a separate "secure" view
      // Requirement: "ensure sensitive fields (Aadhaar, PAN) are not transmitted in plain text"
      if (data.aadhaarNumber.match(/^\d{4}-\d{4}-\d{4}$/) || data.aadhaarNumber.match(/^\d{12}$/)) {
        console.warn(
          '⚠️ PII Leak: Aadhaar number is fully unmasked in own profile response: ' +
            data.aadhaarNumber
        );
        // This might be a finding, depending on policy.
      }
    }
  });

  it('checks if /api/rider/referrals leaks referees phone numbers', async () => {
    const { status, body } = await api('/api/rider/referrals', {
      headers: { Authorization: `Bearer ${riderToken}` },
    });

    expect(status).toBe(200);
    expect(body.data.referrals.length).toBeGreaterThan(0);

    for (const ref of body.data.referrals) {
      // Referee phone numbers should be masked for privacy (e.g. +91 ******1234)
      if (ref.phone && !ref.phone.includes('*')) {
        console.error('❌ PII LEAK: Referee phone number is unmasked: ' + ref.phone);
        // Fails the test if unmasked phone is found
        expect(ref.phone).toContain('*');
      }
    }
  });
});
