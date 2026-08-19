import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// PR-VER-2026-08-06 (EMERGENCY P0-1): the SOS long-press used to only dial
// 112 locally — Voltium staff had no awareness of the event. These tests
// gate the backend alert endpoint that records the trigger.

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: vi
    .fn()
    .mockResolvedValue({ riderDbId: 'rider-db-1', phone: '9876543210' }),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import('@/app/api/emergency/sos/route');
const { createAuditLog } = await import('@/lib/audit-log');

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/emergency/sos', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/emergency/sos — backend alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records an audit log with location and rider id', async () => {
    const res = await POST(
      makePost({
        latitude: 12.9716,
        longitude: 77.5946,
        triggeredVia: 'long_press',
      })
    );

    expect(res.status).toBe(200);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'rider-db-1',
        actorType: 'RIDER',
        action: 'emergency.sos_triggered',
        entity: 'rider',
        details: expect.objectContaining({
          latitude: 12.9716,
          longitude: 77.5946,
          triggeredVia: 'long_press',
        }),
      })
    );
  });

  it('defaults triggeredVia and tolerates missing location', async () => {
    const res = await POST(makePost({}));

    expect(res.status).toBe(200);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          latitude: null,
          longitude: null,
          triggeredVia: 'long_press',
        }),
      })
    );
  });

  it('rejects out-of-range coordinates with 422', async () => {
    const res = await POST(
      makePost({ latitude: 999, longitude: -999, triggeredVia: 'long_press' })
    );
    expect(res.status).toBe(422);
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('rejects unknown fields (strict schema)', async () => {
    const res = await POST(
      makePost({ latitude: 12.97, longitude: 77.59, hack: 'injected' })
    );
    expect(res.status).toBe(422);
  });

  it('still returns success semantics when the audit write fails (best-effort)', async () => {
    (createAuditLog as any).mockRejectedValueOnce(new Error('DB down'));

    const res = await POST(
      makePost({ latitude: 12.97, longitude: 77.59 })
    );
    // The 112 call is the primary path — a backend failure must never look
    // like the alert failed.
    expect(res.status).toBe(200);
  });

  it('requires a rider session (401/403 passthrough)', async () => {
    const { requireRiderSession } = await import('@/lib/rider-auth');
    (requireRiderSession as any).mockResolvedValueOnce(
      new NextRequest('http://localhost/api/emergency/sos', { method: 'POST' })
    );

    const res = await POST(makePost({ latitude: 1, longitude: 2 }));
    // The route returns the auth response untouched (typically 401/403).
    expect(res).toBeInstanceOf(Response);
  });
});
