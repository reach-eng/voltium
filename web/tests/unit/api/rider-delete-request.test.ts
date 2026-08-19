import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// PR-3 (2026-08-07 verification report, Section 2 — Flutter Profile P0-2):
// rider-initiated GDPR/DPDP deletion request. The settings screen used to
// POST `{action: 'DELETE_REQUEST'}` to /api/rider/profile, which had no
// handler — the request was silently dropped. These tests gate the
// dedicated endpoint that records the request (rider marker + audit log).
vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi
    .fn()
    .mockResolvedValue({ riderDbId: 'rider-db-1', phone: '9876543210' }),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      update: vi.fn().mockResolvedValue({ id: 'rider-db-1' }),
    },
  },
}));

const { POST } = await import('@/app/api/rider/account/delete-request/route');
const { requireRiderSession } = await import('@/lib/rider-auth');
const { createAuditLog } = await import('@/lib/audit-log');
const { db } = await import('@/lib/db');
const { errors } = await import('@/lib/api-response');

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/rider/account/delete-request', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/rider/account/delete-request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no rider session is present', async () => {
    (requireRiderSession as any).mockResolvedValueOnce(
      errors.unauthorized('Authentication required')
    );

    const res = await POST(makePost({ reason: 'Leaving the city' }));

    expect(res.status).toBe(401);
    expect(db.rider.update).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('rejects an invalid payload with 400 and writes nothing', async () => {
    // reason must be a string ≤ 500 chars.
    const res = await POST(makePost({ reason: 123 }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(db.rider.update).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('rejects an over-long reason with 400', async () => {
    const res = await POST(makePost({ reason: 'x'.repeat(501) }));

    expect(res.status).toBe(400);
    expect(db.rider.update).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('writes the deletion marker on the rider row', async () => {
    const res = await POST(makePost({ reason: 'I have another provider' }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(db.rider.update).toHaveBeenCalledWith({
      where: { id: 'rider-db-1' },
      data: {
        deletionRequestedAt: expect.any(Date),
        deletionRequestReason: 'I have another provider',
      },
    });
  });

  it('records the audit log with the rider as actor', async () => {
    await POST(makePost({ reason: 'I have another provider' }));

    expect(createAuditLog).toHaveBeenCalledWith({
      actorId: 'rider-db-1',
      actorType: 'RIDER',
      action: 'RIDER_DELETION_REQUESTED',
      entity: 'Rider',
      entityId: 'rider-db-1',
      details: { reason: 'I have another provider' },
    });
  });

  it('defaults reason to null on the marker and "No reason provided" in the audit', async () => {
    const res = await POST(makePost({ timestamp: '2026-08-08T00:00:00Z' }));

    expect(res.status).toBe(200);
    expect(db.rider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletionRequestReason: null }),
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ details: { reason: 'No reason provided' } })
    );
  });
});
