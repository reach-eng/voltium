import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/device/data/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  ),
}));

vi.mock('@/server/modules/device-compliance/device-compliance.use-cases', () => ({
  deviceComplianceUseCases: {
    syncLocation: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('POST /api/device/data — TEST_MODE dev-bypass gate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('rejects dev-bypass in staging environment even if TEST_MODE is true', async () => {
    process.env.TEST_MODE = 'true';
    process.env.APP_ENV = 'staging';
    process.env.NODE_ENV = 'production';

    const req = new NextRequest('http://localhost/api/device/data', {
      method: 'POST',
      body: JSON.stringify({ riderId: 'bypassed-rider-id', type: 'location', data: { lat: 10, lng: 20 } }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
