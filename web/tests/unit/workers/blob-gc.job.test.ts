import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { blobGcJob } from '@/server/workers/jobs/blob-gc.job';
import { db } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    fileRecord: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/idempotency', () => ({
  checkOrClaimIdempotency: vi.fn().mockResolvedValue({ status: 'not_found' }),
  completeIdempotency: vi.fn().mockResolvedValue(undefined),
  failIdempotency: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Blob Garbage Collection Job', () => {
  let tempStorageDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempStorageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blob_gc_test_'));
    process.env.LOCAL_STORAGE_ROOT = tempStorageDir;
  });

  afterEach(async () => {
    delete process.env.LOCAL_STORAGE_ROOT;
    await fs.rm(tempStorageDir, { recursive: true, force: true }).catch(() => {});
  });

  it('skips sweep if storage directory does not exist', async () => {
    process.env.LOCAL_STORAGE_ROOT = path.join(tempStorageDir, 'non_existent_folder');
    const result = await blobGcJob.process({ id: 'test' });
    expect(result.sweptCount).toBe(0);
    expect(result.bytesReclaimed).toBe(0);
  });

  it('preserves recent files within the 24h grace period', async () => {
    const recentFile = path.join(tempStorageDir, 'recent.pdf');
    await fs.writeFile(recentFile, 'recent data');

    const result = await blobGcJob.process({ id: 'test' });
    expect(result.sweptCount).toBe(0);

    const exists = await fs.access(recentFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('sweeps unreferenced orphan files older than 24h', async () => {
    const orphanFile = path.join(tempStorageDir, 'orphan.pdf');
    await fs.writeFile(orphanFile, 'orphan data to delete');

    // Backdate mtime by 2 days
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await fs.utimes(orphanFile, twoDaysAgo, twoDaysAgo);

    // Mock DB: no FileRecord exists for this storageKey
    vi.mocked(db.fileRecord.findFirst).mockResolvedValue(null);

    const result = await blobGcJob.process({ id: 'test' });
    expect(result.sweptCount).toBe(1);
    expect(result.bytesReclaimed).toBe(Buffer.byteLength('orphan data to delete'));

    const exists = await fs.access(orphanFile).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('preserves files older than 24h that are referenced by a FileRecord in DB', async () => {
    const referencedFile = path.join(tempStorageDir, 'referenced.pdf');
    await fs.writeFile(referencedFile, 'important document');

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await fs.utimes(referencedFile, twoDaysAgo, twoDaysAgo);

    // Mock DB: FileRecord exists
    vi.mocked(db.fileRecord.findFirst).mockResolvedValue({ id: 'file-rec-1' } as any);

    const result = await blobGcJob.process({ id: 'test' });
    expect(result.sweptCount).toBe(0);
    expect(result.bytesReclaimed).toBe(0);

    const exists = await fs.access(referencedFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});
