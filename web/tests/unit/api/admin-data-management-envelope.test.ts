/**
 * PR-90 (API N12) — admin/data-management/* routes use the shared envelope.
 *
 * These three routes used to write `NextResponse.json({success,data})`
 * and `NextResponse.json({error: err.message})` directly. After PR-90
 * they go through the shared `success()` / `errors.*()` envelope from
 * `@/lib/api-response`. This test pins the new shape so a regression
 * to the raw `NextResponse.json` body would be caught.
 *
 * Coverage:
 *   - GET /api/admin/data-management/storage returns the envelope on success.
 *   - GET /api/admin/data-management/storage returns the envelope on
 *     permission denial (errors.forbidden, status 403).
 *   - GET /api/admin/data-management/storage returns the generic
 *     "Internal error" body (no err.message leak) on unexpected error.
 *   - GET /api/admin/data-management/restore/history returns the
 *     envelope on success.
 *   - GET /api/admin/data-management/maintenance-mode (the
 *     admin/maintenance-mode route) returns the envelope on success.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const SESSION = {
  riderDbId: 'admin-1',
  adminId: 'admin-1',
  role: 'admin',
  adminRole: 'SUPER_ADMIN',
};

vi.mock('@/lib/get-session', () => ({
  getAdminSession: vi.fn().mockResolvedValue(SESSION),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

const getStorageMock = vi.fn();
const getScheduleMock = vi.fn();
const getRestoreHistoryMock = vi.fn();
const runScheduledBackupNowMock = vi.fn();
const testScheduleMock = vi.fn();
const updateScheduleMock = vi.fn();

vi.mock('@/server/modules/data-management/data-management.use-cases', () => ({
  dataManagementUseCases: {
    getStorage: getStorageMock,
    getSchedule: getScheduleMock,
    getRestoreHistory: getRestoreHistoryMock,
    runScheduledBackupNow: runScheduledBackupNowMock,
    testSchedule: testScheduleMock,
    updateSchedule: updateScheduleMock,
  },
}));

const systemSettingMock = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: systemSettingMock,
      upsert: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/modules/data-management/backup.schemas', () => ({
  scheduleUpdateSchema: { parse: vi.fn((x: any) => x) },
}));

describe('PR-90 (API N12) — admin/data-management/storage envelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStorageMock.mockReset();
    getScheduleMock.mockReset();
    getRestoreHistoryMock.mockReset();
    systemSettingMock.mockReset();
  });

  it('GET returns the success envelope on a happy path', async () => {
    getStorageMock.mockResolvedValue({ totalBytes: 1024, fileCount: 5 });
    const { GET } = await import('@/app/api/admin/data-management/storage/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ totalBytes: 1024, fileCount: 5 });
    expect(body.error).toBeUndefined();
  });

  it('GET returns the forbidden envelope (no err.message leak) on permission denial', async () => {
    getStorageMock.mockRejectedValue(new Error('Unauthorized'));
    const { GET } = await import('@/app/api/admin/data-management/storage/route');
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toMatch(/insufficient role/i);
  });

  it('GET returns a generic 500 body — does NOT leak err.message — on unexpected error', async () => {
    getStorageMock.mockRejectedValue(new Error('sensitive: db connection string password=hunter2'));
    const { GET } = await import('@/app/api/admin/data-management/storage/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/password/);
    expect(text).not.toMatch(/hunter2/);
    expect(text).not.toMatch(/sensitive/);
    expect(text).toMatch(/Internal error/);
  });
});

describe('PR-90 (API N12) — admin/data-management/schedule envelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScheduleMock.mockReset();
  });

  it('GET returns the success envelope', async () => {
    getScheduleMock.mockResolvedValue({ enabled: true, frequency: 'DAILY' });
    const { GET } = await import('@/app/api/admin/data-management/schedule/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ enabled: true, frequency: 'DAILY' });
  });

  it('GET returns the generic 500 body on unexpected error', async () => {
    getScheduleMock.mockRejectedValue(new Error('connection refused: stack trace goes here'));
    const { GET } = await import('@/app/api/admin/data-management/schedule/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/connection refused/);
    expect(text).toMatch(/Internal error/);
  });

  it('POST returns 400 on invalid action', async () => {
    const { POST } = await import('@/app/api/admin/data-management/schedule/route');
    const req = new NextRequest('http://localhost/api/admin/data-management/schedule?action=invalid', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toMatch(/invalid action/i);
  });

  it('POST run-now returns the success envelope', async () => {
    runScheduledBackupNowMock.mockResolvedValue({ jobId: 'b-1', status: 'RUNNING' });
    const { POST } = await import('@/app/api/admin/data-management/schedule/route');
    const req = new NextRequest('http://localhost/api/admin/data-management/schedule?action=run-now', {
      method: 'POST',
    });
    const res = await POST(req);
    // P0-3 (2026-08-07): run-now enqueues to the outbox → 202 Accepted,
    // not 200 — the assertion was stale after the async-jobs refactor.
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.data).toEqual({ jobId: 'b-1', status: 'RUNNING' });
  });
});

describe('PR-90 (API N12) — admin/data-management/restore/history envelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRestoreHistoryMock.mockReset();
  });

  it('GET returns the success envelope', async () => {
    getRestoreHistoryMock.mockResolvedValue([{ id: 'r-1', status: 'COMPLETED' }]);
    const { GET } = await import('@/app/api/admin/data-management/restore/history/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ id: 'r-1', status: 'COMPLETED' }]);
  });

  it('GET returns the forbidden envelope (no err.message leak) on permission denial', async () => {
    getRestoreHistoryMock.mockRejectedValue(new Error('Unauthorized'));
    const { GET } = await import('@/app/api/admin/data-management/restore/history/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('GET returns a generic 500 body — does NOT leak err.message — on unexpected error', async () => {
    getRestoreHistoryMock.mockRejectedValue(new Error('internal stack: file=/etc/secrets/keys.pem'));
    const { GET } = await import('@/app/api/admin/data-management/restore/history/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/keys\.pem/);
    expect(text).not.toMatch(/secrets/);
    expect(text).toMatch(/Internal error/);
  });
});

describe('PR-90 (API N12) — admin/maintenance-mode envelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    systemSettingMock.mockReset();
  });

  it('GET returns the success envelope', async () => {
    systemSettingMock
      .mockResolvedValueOnce({ value: 'true' })
      .mockResolvedValueOnce({ value: 'maintenance message' });
    const { GET } = await import('@/app/api/admin/maintenance-mode/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.enabled).toBe(true);
    expect(body.data.message).toBe('maintenance message');
  });

  it('GET returns a generic 500 body on DB error', async () => {
    systemSettingMock.mockRejectedValue(new Error('db password=secret trace'));
    const { GET } = await import('@/app/api/admin/maintenance-mode/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/password/);
    expect(text).not.toMatch(/secret/);
    // P0-5 (2026-08-05 ops audit): the catch message now follows the
    // 'Failed to ...' convention used by every other admin route.
    expect(text).toMatch(/Failed to fetch maintenance status/);
  });

  it('PUT returns the success envelope', async () => {
    const { PUT } = await import('@/app/api/admin/maintenance-mode/route');
    const req = new NextRequest('http://localhost/api/admin/maintenance-mode', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true, message: 'Going down' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.enabled).toBe(true);
    expect(body.data.message).toBe('Going down');
  });

  it('PUT returns 400 on missing fields', async () => {
    const { PUT } = await import('@/app/api/admin/maintenance-mode/route');
    const req = new NextRequest('http://localhost/api/admin/maintenance-mode', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
