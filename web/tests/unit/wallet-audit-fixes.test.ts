import { describe, test, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi.fn().mockResolvedValue({ riderDbId: 'mock-rider-1' }),
}));

import { DELETE } from '@/app/api/transaction/history/route';

describe('Wallet Workflow Full-Stack Fixes Unit Tests', () => {
  describe('Transaction History Immutability', () => {
    test('DELETE /api/transaction/history returns 405 Method Not Allowed', async () => {
      const req = new NextRequest('http://localhost:8081/api/transaction/history', {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer mock-token',
        },
      });

      const res = await DELETE(req);
      // P1: 405, not 403 — the collection is never deletable.
      expect(res.status).toBe(405);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('immutable');
    });
  });
});
