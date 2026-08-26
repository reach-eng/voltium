import { describe, it, expect, vi, beforeEach } from 'vitest';

// W9 / L-1 — DRAFT/PUBLISHED lifecycle for legal documents.
// Contract under test (legal.use-cases):
//   1. upsert of CHANGED content on an existing doc  → status DRAFT
//   2. byte-identical save                            → true no-op, no churn
//   3. publish()                                      → PUBLISHED + publishedAt,
//                                                       audited, idempotent
//   4. publish() on missing document                  → throws
import { createHash } from 'crypto';

const hashOf = (s: string) => createHash('sha256').update(s).digest('hex');

const dbMock = {
  legalDocument: {
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  legalDocumentRevision: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findFirstMock: undefined as unknown as ReturnType<typeof vi.fn>,
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
};

const txMock = {
  legalDocument: {
    upsert: vi.fn(),
  },
  legalDocumentRevision: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/validators/admin', () => ({
  LEGAL_DOCUMENT_TYPES: [
    { key: 'terms', label: 'Terms of Service' },
    { key: 'privacy', label: 'Privacy Policy' },
  ],
}));

const { legalUseCases } = await import('@/server/modules/legal/legal.use-cases');

const publishedDoc = {
  id: 'doc_1',
  type: 'terms',
  title: 'Terms of Service',
  content: 'v1 content',
  status: 'PUBLISHED',
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('L-1 legal draft/publish lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.legalDocument.upsert.mockReset();
    txMock.legalDocumentRevision.findFirst.mockReset();
    txMock.legalDocumentRevision.create.mockReset();
  });

  it('drops an existing PUBLISHED doc to DRAFT when content changes', async () => {
    dbMock.legalDocument.findUnique.mockResolvedValue({ ...publishedDoc });
    txMock.legalDocument.upsert.mockResolvedValue({
      ...publishedDoc,
      content: 'v2 content',
      status: 'DRAFT',
    });
    txMock.legalDocumentRevision.findFirst.mockResolvedValue(null);
    txMock.legalDocumentRevision.create.mockResolvedValue({});

    const saved = await legalUseCases.upsert(
      { type: 'terms', content: 'v2 content' },
      'admin-1'
    );

    // The upsert data carried DRAFT, not PUBLISHED.
    const callArg = txMock.legalDocument.upsert.mock.calls[0][0];
    expect(callArg.update.status).toBe('DRAFT');
    expect(callArg.create.status).toBe('DRAFT');
    expect(saved.status).toBe('DRAFT');
    // A revision was snapshotted for the changed content.
    expect(txMock.legalDocumentRevision.create).toHaveBeenCalledOnce();
  });

  it('treats a byte-identical save as a no-op (no revision, no status churn)', async () => {
    dbMock.legalDocument.findUnique.mockResolvedValue({ ...publishedDoc });

    const result = await legalUseCases.upsert(
      { type: 'terms', title: 'Terms of Service', content: 'v1 content' },
      'admin-1'
    );

    expect(result.status).toBe('PUBLISHED');
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.legalDocumentRevision.create).not.toHaveBeenCalled();
  });

  it('publish flips DRAFT to PUBLISHED with publishedAt and audits the action', async () => {
    dbMock.legalDocument.findUnique.mockResolvedValue({
      ...publishedDoc,
      status: 'DRAFT',
      publishedAt: null,
    });
    dbMock.legalDocument.update.mockResolvedValue({
      ...publishedDoc,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });

    const out = await legalUseCases.publish('terms', 'admin-1');

    expect(out.status).toBe('PUBLISHED');
    expect(out.publishedAt).toBeTruthy();
    expect(dbMock.legalDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'terms' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      })
    );
    const { createAuditLog } = await import('@/lib/audit-log');
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'legal.publish', actorId: 'admin-1' })
    );
  });

  it('publish is idempotent for already-published docs', async () => {
    dbMock.legalDocument.findUnique.mockResolvedValue({ ...publishedDoc });

    const out = await legalUseCases.publish('terms', 'admin-1');

    expect(out.status).toBe('PUBLISHED');
    expect(dbMock.legalDocument.update).not.toHaveBeenCalled();
  });

  it('publish throws for a missing document', async () => {
    dbMock.legalDocument.findUnique.mockResolvedValue(null);
    await expect(legalUseCases.publish('nope', 'admin-1')).rejects.toThrow(
      /not found/i
    );
  });
});
