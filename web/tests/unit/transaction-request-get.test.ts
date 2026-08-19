import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  requireRiderSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { transaction: { findUnique: mocks.findUnique } },
}));
vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));

import { GET } from '@/app/api/transaction/request/route';

describe('GET /api/transaction/request Receipt Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns single transaction when found and belongs to session rider', async () => {
    mocks.requireRiderSession.mockResolvedValue({ id: 'r_1', riderDbId: 'r_db_1' });
    mocks.findUnique.mockResolvedValue({ id: 'tx_123', riderId: 'r_db_1', amountInPaise: 50000 });

    const req = new NextRequest('http://localhost/api/transaction/request?id=tx_123');

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe('tx_123');
  });

  it('returns 404 when transaction is not found or belongs to another rider', async () => {
    mocks.requireRiderSession.mockResolvedValue({ id: 'r_1', riderDbId: 'r_db_1' });
    mocks.findUnique.mockResolvedValue({ id: 'tx_123', riderId: 'other_rider' });

    const req = new NextRequest('http://localhost/api/transaction/request?id=tx_123');

    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
