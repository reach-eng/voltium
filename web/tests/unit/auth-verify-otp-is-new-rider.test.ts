import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/verify-otp/route';
import { authUseCases } from '@/server/modules/auth/auth.use-cases';
import { checkRateLimit } from '@/lib/rate-limit';

vi.mock('@/server/modules/auth/auth.use-cases', () => ({
  authUseCases: {
    verifyOtp: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

describe('Phase F2: Auth verify-otp isNewRider Contract (Delta F-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always includes isNewRider in verify-otp successful response', async () => {
    vi.mocked(authUseCases.verifyOtp).mockResolvedValueOnce({
      token: 'jwt_token_123',
      refreshToken: 'refresh_token_456',
      riderDbId: 'db_id_1',
      phone: '9876543210',
      isNewRider: true,
      riderData: {
        id: 'r1',
        phone: '9876543210',
        fullName: 'Test Rider',
      },
    });

    const req = new NextRequest('http://localhost:8081/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', otp: '123456' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isNewRider).toBe(true);
    expect(json.data.token).toBe('jwt_token_123');
  });

  it('includes isNewRider: false for existing riders', async () => {
    vi.mocked(authUseCases.verifyOtp).mockResolvedValueOnce({
      token: 'jwt_token_existing',
      refreshToken: 'refresh_token_existing',
      riderDbId: 'db_id_2',
      phone: '9876543210',
      isNewRider: false,
      riderData: {
        id: 'r2',
        phone: '9876543210',
        fullName: 'Existing Rider',
      },
    });

    const req = new NextRequest('http://localhost:8081/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', otp: '654321' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isNewRider).toBe(false);
  });
});
