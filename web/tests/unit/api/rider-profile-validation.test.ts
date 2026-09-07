import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// EDIT-PROFILE-AUDIT P0-4 (2026-09-08): user-correctable
// validation now throws `RiderValidationError` (mapped to 409
// with the actual message) instead of plain `Error` (mapped to
// 500 "Failed to update profile"). These tests pin the
// 409-with-message behavior at the route boundary.

const requireRiderSessionMock = vi.fn();
const riderUseCasesMock = {
  updateProfile: vi.fn(),
};
const checkProfileRateLimitMock = vi.fn();

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: (...args: unknown[]) => requireRiderSessionMock(...args),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkProfileRateLimit: (...args: unknown[]) => checkProfileRateLimitMock(...args),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 60, resetAt: 0 }),
}));
vi.mock('@/server/modules/riders/rider.use-cases', () => ({
  riderUseCases: riderUseCasesMock,
}));
// Import the real class so `instanceof` works in the test
// environment. The class is the route's only check; a plain
// Error with `name: 'RiderValidationError'` would not pass.
import { RiderValidationError } from '@/server/modules/riders/rider-lifecycle.service';
// The route uses `validateBody(updateProfileSchema, body)`. Stub
// the validator to always pass so the test focuses on the
// RiderValidationError catch path.
vi.mock('@/lib/validators', () => ({
  validateBody: (_schema: unknown, body: unknown) => ({ success: true as const, data: body }),
  updateProfileSchema: {},
}));
vi.mock('@/lib/api-money', () => ({
  toRupeesResponse: (x: unknown) => x,
}));

const { PUT } = await import('@/app/api/rider/profile/route');

const RIDER = { riderDbId: 'rider-1', phone: '9876543210' };
const VALID_BODY = { riderId: 'rider-1', fullName: 'Test Rider' };

function makePut(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/rider/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRiderSessionMock.mockResolvedValue(RIDER);
  checkProfileRateLimitMock.mockResolvedValue(null);
  riderUseCasesMock.updateProfile.mockResolvedValue({ id: 'rider-1' });
});

describe('PUT /api/rider/profile — P0-4 user-correctable validation', () => {
  it('returns 409 with the DOB age message when the rider is under 18', async () => {
    // The use-cases now throws a typed RiderValidationError
    // for user-correctable failures. The route maps it to
    // 409 with the message — the client renders it verbatim.
    riderUseCasesMock.updateProfile.mockRejectedValueOnce(
      new RiderValidationError('Rider must be at least 18 years old')
    );

    const res = await PUT(makePut(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error?.message).toBe('Rider must be at least 18 years old');
  });

  it('returns 409 with the guarantor self-phone message when the rider enters their own number', async () => {
    riderUseCasesMock.updateProfile.mockRejectedValueOnce(
      new RiderValidationError('Guarantor phone cannot be the same as rider phone')
    );

    const res = await PUT(makePut(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error?.message).toBe('Guarantor phone cannot be the same as rider phone');
  });

  it('returns 409 with the emergency contact = own number message', async () => {
    riderUseCasesMock.updateProfile.mockRejectedValueOnce(
      new RiderValidationError('Emergency contact cannot be your own number')
    );

    const res = await PUT(makePut(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error?.message).toBe('Emergency contact cannot be your own number');
  });

  it('still returns 500 for genuine server faults (non-typed errors)', async () => {
    // Plain Error (not RiderValidationError, not RiderLifecycleError)
    // falls through to the catch-all 500. The 500 path is reserved
    // for genuine server faults — the route's `logger.error` fires
    // so the operator sees the real cause.
    riderUseCasesMock.updateProfile.mockRejectedValueOnce(
      new Error('database connection refused')
    );

    const res = await PUT(makePut(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
