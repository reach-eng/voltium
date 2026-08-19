import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/server/modules/auth/auth.use-cases', () => ({
  authUseCases: { verifyOtp: mocks.verifyOtp },
}));

import { POST_verifyOtp } from '@/server/modules/auth/auth.routes';

describe('Modules Auth Route Response Shape Alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST_verifyOtp returns token, refreshToken, and riderData in response payload', async () => {
    mocks.verifyOtp.mockResolvedValue({
      riderId: 'VF-RD-0001',
      isNewRider: false,
      token: 'jwt_access_token',
      refreshToken: 'jwt_refresh_token',
      riderData: { fullName: 'John Doe', phone: '9876543210' },
    });

    const req = new NextRequest('http://localhost/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9876543210', otp: '123456' }),
    });

    const res = await POST_verifyOtp(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.token).toBe('jwt_access_token');
    expect(json.data.refreshToken).toBe('jwt_refresh_token');
    expect(json.data.fullName).toBe('John Doe');
  });
});
