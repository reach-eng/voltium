import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// PR-26b: the route now delegates to the dedicated `submitReturn` use case
// instead of `riderUseCases.updateProfile`.
vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi.fn().mockResolvedValue({ riderDbId: 'test-rider-id' }),
}));

vi.mock('@/server/modules/rentals/use-cases/submitReturn', () => ({
  submitReturn: vi.fn().mockResolvedValue({
    returnId: 'return-1',
    vehicleId: 'v-1',
    rentalStatus: 'RETURN_PENDING',
  }),
}));

// Late import so the mocks above are wired up first.
const { POST } = await import('@/app/api/rider/rental/return/route');
const { submitReturn } = await import('@/server/modules/rentals/use-cases/submitReturn');

describe('POST /api/rider/rental/return — mass-assignment protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (submitReturn as any).mockResolvedValue({
      returnId: 'return-1',
      vehicleId: 'v-1',
      rentalStatus: 'RETURN_PENDING',
    });
  });

  it('rejects requests with extra fields (e.g. kycStatus, phone)', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({
        latitude: 12.97,
        longitude: 77.59,
        kycStatus: 'APPROVED', // Illegal extra field
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('accepts requests with valid return fields and calls submitReturn', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({
        latitude: 12.97,
        longitude: 77.59,
        reason: 'End of trip',
        returnPhotos: [
          'https://cdn.example.com/left.jpg',
          'https://cdn.example.com/right.jpg',
          'https://cdn.example.com/front.jpg',
          'https://cdn.example.com/speedometer.jpg',
        ],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(submitReturn).toHaveBeenCalledWith(
      'test-rider-id',
      expect.objectContaining({
        photoUrls: expect.arrayContaining([
          'https://cdn.example.com/left.jpg',
          'https://cdn.example.com/right.jpg',
          'https://cdn.example.com/front.jpg',
          'https://cdn.example.com/speedometer.jpg',
        ]),
        reason: 'End of trip',
      })
    );
  });

  it('handles invalid JSON body gracefully', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
