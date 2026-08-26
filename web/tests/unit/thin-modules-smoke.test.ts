/**
 * PR-M (Ticket #22.1) — smoke tests for thin single-use-cases modules.
 *
 * Per docs/AUDIT_SMALL_SERVER_MODULES_2026-07-30.md finding 3.1, 12 modules
 * are single-use-cases files with no dedicated unit tests:
 *   - announcements, coupons, legal, monitoring, offers, plans, pricing,
 *     referrals, shifts, sync, telemetry
 *
 * This file batches smoke tests for 4 of the smallest:
 *   - legal (0.8 KB, 2 use cases: list, upsert)
 *   - telemetry (0.7 KB, 1 use case: cleanup)
 *   - offers (2.4 KB, 4 use cases: listAdmin, create, update, delete, getActiveSponsored)
 *   - sync (2.7 KB, 2 use cases: queueActions, getPending)
 *
 * The other 8 modules get separate smoke test files (or are covered by
 * existing tests like `auth-referral-exists.test.ts` for referrals).
 *
 * Run: npx vitest run tests/unit/thin-modules-smoke.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockDb, mockAuditLog } = vi.hoisted(() => {
  const mockDb: any = {};
  const mockAuditLog = vi.fn(() => Promise.resolve());
  return { mockDb, mockAuditLog };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mockAuditLog,
}));

// ---------------------------------------------------------------------------
// legal
// ---------------------------------------------------------------------------
import { legalUseCases } from '@/server/modules/legal/legal.use-cases';

describe('legal (thin module) — smoke tests (#22.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.legalDocument = {
      findMany: vi.fn(),
      upsert: vi.fn(),
      // W9 / L-1: upsert pre-reads the doc for draft/publish semantics.
      // Default null = brand-new document path.
      findUnique: vi.fn().mockResolvedValue(null),
    };
    mockDb.legalDocumentRevision = {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    };
    // P1-2 (2026-08-05 legal/device audit): upsert now writes the doc AND a
    // revision row inside a $transaction (skipped when content is unchanged),
    // and no longer sanitizes HTML (P1-3) — the rider app renders legal
    // content as plain text.
    mockDb.$transaction = vi.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        legalDocument: mockDb.legalDocument,
        legalDocumentRevision: mockDb.legalDocumentRevision,
      })
    );
  });

  it('list() returns documents ordered by type', async () => {
    const docs = [
      { id: 'd1', type: 'PRIVACY_POLICY' },
      { id: 'd2', type: 'TERMS' },
    ];
    mockDb.legalDocument.findMany.mockResolvedValue(docs);
    const result = await legalUseCases.list();
    expect(result).toEqual(docs);
    expect(mockDb.legalDocument.findMany).toHaveBeenCalledWith({ orderBy: { type: 'asc' } });
  });

  it('upsert() writes a revision and audit log (no sanitize — P1-2/P1-3)', async () => {
    mockDb.legalDocument.upsert.mockResolvedValue({ id: 'd1', type: 'TERMS', title: 'Terms' });
    mockDb.legalDocumentRevision.create.mockResolvedValue({});
    await legalUseCases.upsert({ type: 'TERMS', content: 'raw html' }, 'admin-1');
    expect(mockDb.legalDocument.upsert).toHaveBeenCalled();
    // Revision row written inside the transaction
    expect(mockDb.legalDocumentRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          legalDocumentId: 'd1',
          createdBy: 'admin-1',
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      })
    );
    // Audit log is fire-and-forget, give it a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'legal.update' })
    );
  });
});

// ---------------------------------------------------------------------------
// telemetry
// ---------------------------------------------------------------------------
import { telemetryUseCases } from '@/server/modules/telemetry/telemetry.use-cases';

describe('telemetry (thin module) — smoke tests (#22.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.userLocation = { deleteMany: vi.fn() };
    mockDb.userCallLog = { deleteMany: vi.fn() };
    mockDb.userContact = { deleteMany: vi.fn() };
  });

  it('cleanup() defaults to 30-day retention', async () => {
    mockDb.userLocation.deleteMany.mockResolvedValue({ count: 5 });
    mockDb.userCallLog.deleteMany.mockResolvedValue({ count: 3 });
    mockDb.userContact.deleteMany.mockResolvedValue({ count: 1 });

    const result = await telemetryUseCases.cleanup();
    expect(result).toEqual({
      locationsDeleted: 5,
      callLogsDeleted: 3,
      contactsDeleted: 1,
      retentionDays: 30,
    });
    // All three delete calls made
    expect(mockDb.userLocation.deleteMany).toHaveBeenCalled();
    expect(mockDb.userCallLog.deleteMany).toHaveBeenCalled();
    expect(mockDb.userContact.deleteMany).toHaveBeenCalled();
  });

  it('cleanup() respects custom retention', async () => {
    mockDb.userLocation.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.userCallLog.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.userContact.deleteMany.mockResolvedValue({ count: 0 });

    const result = await telemetryUseCases.cleanup(7);
    expect(result.retentionDays).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// offers
// ---------------------------------------------------------------------------
import { offerUseCases } from '@/server/modules/offers/offer.use-cases';

describe('offers (thin module) — smoke tests (#22.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.offer = {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
  });

  it('listAdmin() paginates correctly', async () => {
    const offers = [{ id: 'o1', title: 'Test' }];
    mockDb.offer.findMany.mockResolvedValue(offers);
    mockDb.offer.count.mockResolvedValue(45);

    const result = await offerUseCases.listAdmin(2, 10);
    expect(result.offers).toBe(offers);
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 45, totalPages: 5 });
    expect(mockDb.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it('create() parses dates and calls audit log', async () => {
    mockDb.offer.create.mockResolvedValue({ id: 'o1', title: 'Promo' });
    const result = await offerUseCases.create(
      {
        title: 'Promo',
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        isSponsored: true,
        isActive: true,
      },
      'admin-1'
    );
    expect(result.id).toBe('o1');
    expect(mockDb.offer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validFrom: new Date('2026-01-01'),
          // T-94 + P2-15 (2026-08-23): a YYYY-MM-DD `validUntil`
          // is the operator's "valid through the END of that day",
          // not midnight at the start. See lib/date-normalize.ts.
          validUntil: new Date('2026-12-31T23:59:59.999Z'),
          isSponsored: true,
          isActive: true,
        }),
      })
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'offer.create' })
    );
  });

  it('update() converts validFrom/validUntil to Date', async () => {
    mockDb.offer.update.mockResolvedValue({ id: 'o1' });
    await offerUseCases.update('o1', { validFrom: '2026-02-01', validUntil: '2026-06-01' }, 'admin-1');
    expect(mockDb.offer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validFrom: new Date('2026-02-01'),
          // T-94 + P2-15: end-of-day normalization also applies to update.
          validUntil: new Date('2026-06-01T23:59:59.999Z'),
        }),
      })
    );
  });

  it('delete() removes and logs', async () => {
    mockDb.offer.delete.mockResolvedValue({});
    await offerUseCases.delete('o1', 'admin-1');
    expect(mockDb.offer.delete).toHaveBeenCalledWith({ where: { id: 'o1' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'offer.delete' })
    );
  });

  it('getActiveSponsored() filters by isActive/isSponsored/validUntil', async () => {
    mockDb.offer.findMany.mockResolvedValue([]);
    await offerUseCases.getActiveSponsored();
    expect(mockDb.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          isSponsored: true,
          validUntil: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// sync
// ---------------------------------------------------------------------------
import { syncUseCases } from '@/server/modules/sync/sync.use-cases';

describe('sync (thin module) — smoke tests (#22.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.syncQueue = {
      create: vi.fn(),
      findMany: vi.fn(),
    };
  });

  it('queueActions() rejects invalid action types', async () => {
    const result = await syncUseCases.queueActions('rider-1', [
      { actionType: 'INVALID', endpoint: '/api/x', method: 'POST' },
    ]);
    expect(result.queued).toBe(0);
    expect(result.results[0].status).toBe('FAILED');
    expect(result.results[0].error).toMatch(/Invalid action type/);
  });

  it('queueActions() rejects missing endpoint/method', async () => {
    const result = await syncUseCases.queueActions('rider-1', [
      { actionType: 'CREATE_TICKET' },
    ]);
    expect(result.queued).toBe(0);
    expect(result.results[0].error).toMatch(/Endpoint and method required/);
  });

  it('queueActions() queues valid actions', async () => {
    mockDb.syncQueue.create.mockResolvedValue({ id: 'q1' });
    const result = await syncUseCases.queueActions('rider-1', [
      { actionType: 'CREATE_TICKET', endpoint: '/api/support/tickets', method: 'POST', payload: { foo: 'bar' } },
      { actionType: 'SUBMIT_TOPUP', endpoint: '/api/transaction/request', method: 'POST' },
    ]);
    expect(result.queued).toBe(2);
    expect(mockDb.syncQueue.create).toHaveBeenCalledTimes(2);
  });

  it('getPending() returns pending + syncing counts', async () => {
    mockDb.syncQueue.findMany.mockResolvedValue([
      { id: 'q1', actionType: 'A', endpoint: '/x', method: 'POST', retryCount: 0, createdAt: new Date(), status: 'PENDING' },
      { id: 'q2', actionType: 'B', endpoint: '/y', method: 'POST', retryCount: 1, createdAt: new Date(), status: 'FAILED' },
      { id: 'q3', actionType: 'C', endpoint: '/z', method: 'POST', retryCount: 0, createdAt: new Date(), status: 'SYNCING' },
    ]);
    const result = await syncUseCases.getPending('rider-1');
    expect(result.pending).toHaveLength(2);
    expect(result.syncing).toBe(1);
    expect(result.totalPending).toBe(2);
  });
});
