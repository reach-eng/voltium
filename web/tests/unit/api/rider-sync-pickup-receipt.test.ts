import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi.fn().mockResolvedValue({ riderDbId: 'test-rider-id' }),
}));

vi.mock('@/server/modules/pickup/use-cases', () => ({
  completePickupVerification: vi.fn().mockResolvedValue({ activated: true }),
  PickupVerificationError: class PickupVerificationError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Late imports so the mocks above are wired up first.
const { POST } = await import('@/app/api/rider/sync/pickup/route');
const { completePickupVerification } = await import(
  '@/server/modules/pickup/use-cases'
);
const { env } = await import('@/lib/env');
const { issueVerifyReceipt } = await import('@/lib/verify-receipt');

function pickupRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/rider/sync/pickup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const BASE_BODY = {
  vehicleId: 'v-1',
  hubId: 'hub-1',
  emergencyContact: '9876543210',
  pickupPhotoFront: 'https://cdn.example.com/front.png',
  pickupPhotoBack: 'https://cdn.example.com/back.png',
};

describe('POST /api/rider/sync/pickup — emergency-contact receipt gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (completePickupVerification as any).mockResolvedValue({ activated: true });
    // Default: lenient (backward compatible). Enforcement toggled per-test.
    (env as any).REQUIRE_EMERGENCY_CONTACT_RECEIPT = false;
  });

  afterEach(() => {
    (env as any).REQUIRE_EMERGENCY_CONTACT_RECEIPT = false;
  });

  it('accepts a valid receipt and forwards the digits-normalized contact', async () => {
    const receipt = issueVerifyReceipt('9876543210');
    const res = await POST(pickupRequest({ ...BASE_BODY, emergencyContactReceipt: receipt }));
    expect(res.status).toBe(200);
    expect(completePickupVerification).toHaveBeenCalledWith(
      'test-rider-id',
      expect.objectContaining({
        emergencyContact: '9876543210',
        vehicleId: 'v-1',
      })
    );
  });

  it('rejects a country-code-prefixed contact (exact digits match required)', async () => {
    // The receipt binds the exact digits OTP-verified. A +91-prefixed contact
    // normalizes to 919876543210 — which does NOT equal the verified
    // 9876543210 — so it is rejected rather than silently accepted. (The
    // Flutter app enforces a 10-digit emergency contact, so this path is
    // unreachable from the UI; the strictness is deliberate.)
    const receipt = issueVerifyReceipt('9876543210');
    const res = await POST(
      pickupRequest({
        ...BASE_BODY,
        emergencyContact: '+919876543210',
        emergencyContactReceipt: receipt,
      })
    );
    expect(res.status).toBe(400);
    expect(completePickupVerification).not.toHaveBeenCalled();
  });

  it('rejects a receipt for a different phone than the emergency contact', async () => {
    const receipt = issueVerifyReceipt('9999000000'); // verified a DIFFERENT number
    const res = await POST(pickupRequest({ ...BASE_BODY, emergencyContactReceipt: receipt }));
    expect(res.status).toBe(400);
    expect(completePickupVerification).not.toHaveBeenCalled();
  });

  it('rejects an expired receipt', async () => {
    // Hand-sign a receipt with an already-past expiry using the same secret
    // resolution the helper uses in test (JWT_SECRET fallback).
    const payload = `9876543210:${Date.now() - 1000}`;
    const hmac = createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex');
    const res = await POST(
      pickupRequest({ ...BASE_BODY, emergencyContactReceipt: `${Date.now() - 1000}.${hmac}` })
    );
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(200);
    expect(completePickupVerification).not.toHaveBeenCalled();
  });

  it('rejects a tampered receipt', async () => {
    const receipt = issueVerifyReceipt('9876543210');
    const tampered = `${receipt.slice(0, -1)}${receipt.endsWith('a') ? 'b' : 'a'}`;
    const res = await POST(pickupRequest({ ...BASE_BODY, emergencyContactReceipt: tampered }));
    expect(res.status).toBe(400);
    expect(completePickupVerification).not.toHaveBeenCalled();
  });

  it('ignores legacy client-asserted verifiedPhone/verifiedAt (never trusted)', async () => {
    // A client-claimed verifiedAt from anywhere in the past is NOT proof —
    // the route must ignore both fields and accept the request (lenient mode)
    // without treating them as a receipt.
    const res = await POST(
      pickupRequest({
        ...BASE_BODY,
        verifiedPhone: '9876543210',
        verifiedAt: 123456789,
      })
    );
    expect(res.status).toBe(200);
    expect(completePickupVerification).toHaveBeenCalled();
  });

  it('accepts a submission with no emergency contact at all (nothing to verify)', async () => {
    const res = await POST(
      pickupRequest({
        vehicleId: 'v-1',
        pickupPhotoFront: 'https://cdn.example.com/front.png',
        pickupPhotoBack: 'https://cdn.example.com/back.png',
      })
    );
    expect(res.status).toBe(200);
    expect(completePickupVerification).toHaveBeenCalled();
  });

  it('enforces the receipt when REQUIRE_EMERGENCY_CONTACT_RECEIPT=true', async () => {
    (env as any).REQUIRE_EMERGENCY_CONTACT_RECEIPT = true;

    // No receipt → rejected.
    const without = await POST(pickupRequest(BASE_BODY));
    expect(without.status).toBe(400);
    expect(completePickupVerification).not.toHaveBeenCalled();

    // Valid receipt → accepted.
    const receipt = issueVerifyReceipt('9876543210');
    const withReceipt = await POST(
      pickupRequest({ ...BASE_BODY, emergencyContactReceipt: receipt })
    );
    expect(withReceipt.status).toBe(200);
    expect(completePickupVerification).toHaveBeenCalled();

    // No emergency contact → nothing to enforce → accepted.
    const noContact = await POST(
      pickupRequest({
        vehicleId: 'v-1',
        pickupPhotoFront: 'https://cdn.example.com/front.png',
        pickupPhotoBack: 'https://cdn.example.com/back.png',
      })
    );
    expect(noContact.status).toBe(200);
  });
});
