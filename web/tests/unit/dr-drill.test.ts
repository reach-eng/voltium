import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/dr-drill/route';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth';
import { getAdminSession } from '@/lib/get-session';
import { createAuditLog } from '@/lib/audit-log';

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    outboxEvent: {
      count: vi.fn().mockResolvedValue(5),
    },
    backupJob: {
      // W10 / I-8: the drill now enforces a 48h freshness floor on the
      // checksum step — fixture uses a fresh timestamp to score 5/5.
      findFirst: vi.fn().mockResolvedValue({
        id: 'bkp_1',
        status: 'COMPLETED',
        createdAt: new Date(),
      }),
    },
  },
}));

// hasPermission is synchronous in production (permissions.ts) — mock it
// sync, otherwise the route's `if (!canRunDrill)` sees a truthy Promise.
vi.mock('@/lib/auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

// The route authenticates via the full admin session (getAdminSession) —
// richer than the legacy getAdminId (401/403/500 split).
vi.mock('@/lib/get-session', () => ({
  getAdminSession: vi.fn().mockResolvedValue({
    adminId: 'admin_123',
    riderDbId: 'admin_123',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
  }),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue({ id: 'audit_123' }),
}));

describe('DR Drill Runner API (POST /api/admin/dr-drill)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BACKUP_DIR = process.cwd();
    process.env.PII_ENCRYPTION_KEY_V1 = 'test_key_32_bytes_long_secret_key!';
  });

  it('runs 5 checks and returns a 5/5 score report with audit logging', async () => {
    const req = new Request('http://localhost:8081/api/admin/dr-drill', {
      method: 'POST',
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.score).toBe(5);
    expect(body.data.maxScore).toBe(5);
    expect(body.data.status).toBe('PASSED');
    expect(body.data.steps).toHaveLength(5);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DR_DRILL_COMPLETED',
        actorId: 'admin_123',
        details: expect.objectContaining({
          score: 5,
          maxScore: 5,
        }),
      })
    );
  });

  it('returns 401 Unauthorized if admin is not authenticated', async () => {
    vi.mocked(getAdminSession).mockResolvedValueOnce(null);

    const req = new Request('http://localhost:8081/api/admin/dr-drill', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 Forbidden if admin lacks DATA_MANAGEMENT permission', async () => {
    vi.mocked(hasPermission).mockReturnValueOnce(false);

    const req = new Request('http://localhost:8081/api/admin/dr-drill', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
