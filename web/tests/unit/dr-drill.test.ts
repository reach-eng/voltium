import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/dr-drill/route';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth';
import { getAdminId } from '@/lib/get-session';
import { createAuditLog } from '@/lib/audit-log';

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    outboxEvent: {
      count: vi.fn().mockResolvedValue(5),
    },
    backupRecord: {
      findFirst: vi.fn().mockResolvedValue({ id: 'bkp_1', status: 'COMPLETED' }),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/get-session', () => ({
  getAdminId: vi.fn().mockResolvedValue('admin_123'),
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
    vi.mocked(getAdminId).mockResolvedValueOnce(null);

    const req = new Request('http://localhost:8081/api/admin/dr-drill', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 Forbidden if admin lacks DATA_MANAGEMENT permission', async () => {
    vi.mocked(hasPermission).mockResolvedValueOnce(false);

    const req = new Request('http://localhost:8081/api/admin/dr-drill', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
