import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/admin/dr-drill/route';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth';
import { getAdminSession } from '@/lib/get-session';
import { createAuditLog } from '@/lib/audit-log';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    outboxEvent: {
      count: vi.fn().mockResolvedValue(5),
    },
    backupJob: {
      findFirst: vi.fn().mockResolvedValue({ id: 'bkp_1', status: 'COMPLETED' }),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

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
  let tempBackupDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dr_drill_test_'));
    process.env.BACKUP_DIR = tempBackupDir;
    process.env.BACKUP_ENCRYPTION_KEY = 'test_backup_encryption_key_32_chars!';
    process.env.PII_ENCRYPTION_KEY_V1 = 'test_key_32_bytes_long_secret_key!';
  });

  afterEach(() => {
    if (fs.existsSync(tempBackupDir)) {
      fs.rmSync(tempBackupDir, { recursive: true, force: true });
    }
  });

  it('runs 6 checks and returns a 6/6 score report with PASSED status when valid backup exists', async () => {
    // Create a mock encrypted backup file with OpenSSL Salted__ header
    const mockBackupFile = path.join(tempBackupDir, 'voltium_20260904_test.sql.enc');
    const header = Buffer.from('Salted__dummy_encrypted_contents_for_test');
    fs.writeFileSync(mockBackupFile, header);

    const req = new Request('http://localhost:8081/api/admin/dr-drill', {
      method: 'POST',
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.score).toBe(6);
    expect(body.data.maxScore).toBe(6);
    expect(body.data.status).toBe('PASSED');
    expect(body.data.steps).toHaveLength(6);

    const restoreStep = body.data.steps.find((s: any) => s.id === 'restore_verification');
    expect(restoreStep).toBeDefined();
    expect(restoreStep.passed).toBe(true);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DR_DRILL_COMPLETED',
        actorId: 'admin_123',
        details: expect.objectContaining({
          score: 6,
          maxScore: 6,
          status: 'PASSED',
        }),
      })
    );
  });

  it('marks drill as WARNING and does NOT pass when restore verification fails due to missing backup files', async () => {
    // Directory is empty - no backup files to restore
    const req = new Request('http://localhost:8081/api/admin/dr-drill', {
      method: 'POST',
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).not.toBe('PASSED');
    expect(body.data.status).toBe('WARNING');
    const restoreStep = body.data.steps.find((s: any) => s.id === 'restore_verification');
    expect(restoreStep.passed).toBe(false);
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
