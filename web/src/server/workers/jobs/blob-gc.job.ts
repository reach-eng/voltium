import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';
import fs from 'fs/promises';
import path from 'path';

export interface BlobGcResult {
  sweptCount: number;
  bytesReclaimed: number;
}

export const blobGcJob = {
  async getStorageDir(): Promise<string> {
    try {
      const setting = await db.systemSetting.findUnique({
        where: { key: 'LOCAL_STORAGE_ROOT' },
      });
      if (setting?.value) return setting.value;
    } catch {}
    return process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), 'data', 'uploads');
  },

  async process(job: Pick<QueueJob, 'id'>): Promise<BlobGcResult> {
    logger.info('[BlobGcJob] Starting storage blob garbage collection', { jobId: job.id });

    const today = istDateKey(clock.now());
    const idempotencyKey = `blob-gc:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800);
    if (job?.id !== 'test' && claim.status !== 'not_found') {
      logger.info('[BlobGcJob] Already processed today', { key: idempotencyKey });
      return { sweptCount: 0, bytesReclaimed: 0 };
    }

    try {
      const baseDir = await this.getStorageDir();
      try {
        await fs.access(baseDir);
      } catch {
        logger.info('[BlobGcJob] Storage directory does not exist — skipping sweep', { baseDir });
        await completeIdempotency(idempotencyKey, { sweptCount: 0, bytesReclaimed: 0 }).catch(() => {});
        return { sweptCount: 0, bytesReclaimed: 0 };
      }

      // Collect all files in storage root
      const files: Array<{ fullPath: string; storageKey: string; size: number; mtime: Date }> = [];
      async function walk(currentDir: string) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const stat = await fs.stat(fullPath);
            const relKey = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            files.push({ fullPath, storageKey: relKey, size: stat.size, mtime: stat.mtime });
          }
        }
      }

      await walk(baseDir);

      // Only sweep files older than 24 hours to prevent deleting in-flight uploads
      const gracePeriodCutoff = new Date(clock.now().getTime() - 24 * 60 * 60 * 1000);
      const candidates = files.filter((f) => f.mtime < gracePeriodCutoff);

      let sweptCount = 0;
      let bytesReclaimed = 0;

      for (const candidate of candidates) {
        // Query if this file is referenced by any FileRecord in the DB
        const record = await db.fileRecord.findFirst({
          where: { storageKey: candidate.storageKey },
          select: { id: true },
        });

        if (!record) {
          try {
            await fs.unlink(candidate.fullPath);
            sweptCount += 1;
            bytesReclaimed += candidate.size;
          } catch (unlinkErr) {
            logger.warn('[BlobGcJob] Failed to unlink orphan file', {
              file: candidate.fullPath,
              err: unlinkErr,
            });
          }
        }
      }

      await completeIdempotency(idempotencyKey, { sweptCount, bytesReclaimed }).catch(() => {});
      logger.info('[BlobGcJob] Garbage collection sweep completed', {
        candidatesCount: candidates.length,
        sweptCount,
        bytesReclaimed,
      });

      return { sweptCount, bytesReclaimed };
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
