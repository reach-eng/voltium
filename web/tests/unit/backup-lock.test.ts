import { describe, it, expect, vi, beforeEach } from 'vitest';
import { backupService } from '@/server/modules/data-management/backup.service';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(db)),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Backup Lock Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquires lock when status is NONE', async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null); // defaults to NONE
    vi.mocked(db.setting.upsert).mockResolvedValue({} as any);

    const result = await backupService.acquireLock('BACKUP_RUNNING', 'test-owner');
    expect(result).toBe(true);
    expect(db.setting.upsert).toHaveBeenCalledTimes(3);
  });

  it('fails to acquire lock when status is not NONE', async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: '1',
      key: 'BACKUP_LOCK_STATUS',
      value: 'RESTORE_RUNNING',
      updatedAt: new Date(),
    });

    const result = await backupService.acquireLock('BACKUP_RUNNING', 'test-owner');
    expect(result).toBe(false);
    expect(db.setting.upsert).not.toHaveBeenCalled();
  });

  it('releases lock correctly', async () => {
    vi.mocked(db.setting.upsert).mockResolvedValue({} as any);

    await backupService.releaseLock();
    expect(db.setting.upsert).toHaveBeenCalledTimes(3);
    expect(db.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { key: 'BACKUP_LOCK_STATUS', value: 'NONE' } })
    );
  });

  it('gets lock status correctly', async () => {
    vi.mocked(db.setting.findUnique)
      .mockResolvedValueOnce({ value: 'BACKUP_RUNNING' } as any) // status
      .mockResolvedValueOnce({ value: '2026-06-16T00:00:00.000Z' } as any) // startedAt
      .mockResolvedValueOnce({ value: 'scheduled-worker' } as any); // owner

    const status = await backupService.getLockStatus();
    expect(status.status).toBe('BACKUP_RUNNING');
    expect(status.startedAt).toBe('2026-06-16T00:00:00.000Z');
    expect(status.owner).toBe('scheduled-worker');
  });
});
