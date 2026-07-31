import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/rider/rental/return/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi.fn().mockResolvedValue({ riderDbId: 'test-rider-id' }),
}));

vi.mock('@/server/modules/riders/rider.use-cases', () => ({
  riderUseCases: {
    updateProfile: vi.fn().mockResolvedValue({ id: 'test-rider-id', returnPending: true }),
  },
}));

describe('POST /api/rider/rental/return — mass-assignment protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('accepts requests with valid return fields', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({
        latitude: 12.97,
        longitude: 77.59,
        reason: 'End of trip',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
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
