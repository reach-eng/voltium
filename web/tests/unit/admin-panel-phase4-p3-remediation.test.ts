import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminFaqUseCases } from '@/server/modules/support/admin-faq.use-cases';

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    faq: {
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(3),
    },
    $transaction: vi.fn().mockImplementation((queries) => Promise.all(queries)),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Panel Phase 4 (P3 Polish) Remediation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('P3-07: FAQ Reordering Sequential Indexing', () => {
    it('normalizes and re-indexes FAQs sequentially even when initial order indexes are identical', async () => {
      const { db } = await import('@/lib/db');

      const mockFaqs = [
        { id: 'faq_1', question: 'Q1', order: 0, createdAt: new Date('2026-01-01') },
        { id: 'faq_2', question: 'Q2', order: 0, createdAt: new Date('2026-01-02') },
        { id: 'faq_3', question: 'Q3', order: 0, createdAt: new Date('2026-01-03') },
      ];

      vi.mocked(db.faq.findMany).mockResolvedValueOnce(mockFaqs as any);
      vi.mocked(db.faq.update).mockImplementation(({ where, data }) =>
        Promise.resolve({ ...mockFaqs.find((f) => f.id === where.id), ...data } as any)
      );

      // Reorder faq_2 upwards (to index 0)
      await adminFaqUseCases.reorder('faq_2', 'up', 'admin_1');

      expect(db.$transaction).toHaveBeenCalled();
      const updateCalls = vi.mocked(db.faq.update).mock.calls;

      // The new sequence should be: faq_2 (order 0), faq_1 (order 1), faq_3 (order 2)
      expect(updateCalls).toHaveLength(3);
      expect(updateCalls[0][0]).toEqual({ where: { id: 'faq_2' }, data: { order: 0 } });
      expect(updateCalls[1][0]).toEqual({ where: { id: 'faq_1' }, data: { order: 1 } });
      expect(updateCalls[2][0]).toEqual({ where: { id: 'faq_3' }, data: { order: 2 } });
    });
  });
});
