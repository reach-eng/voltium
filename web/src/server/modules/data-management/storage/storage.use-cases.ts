import { getStorageOverview } from './storage.service';
import { backupPolicy } from '../backup/backup.policy';
import type { AdminRole } from '../../admin/admin.types';
import { db } from '@/lib/db';
import { AuthError } from "@/lib/api-error";

export const storageUseCases = {
  async getStorage(adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const overview = await getStorageOverview();

    let largestFileCategories: { category: string; sizeBytes: number }[] = [];
    try {
      const categories: { purpose: string; _sum: { sizeBytes: number | null } }[] =
        (await db.fileRecord.groupBy({
          by: ['purpose'],
          _sum: { sizeBytes: true },
          orderBy: { _sum: { sizeBytes: 'desc' as const } },
          take: 10,
        })) as any;
      largestFileCategories = categories
        .filter((c) => c._sum.sizeBytes !== null)
        .map((c) => ({ category: c.purpose, sizeBytes: Number(c._sum.sizeBytes) }));
    } catch {}

    let databaseSizeBytes = 0;
    try {
      const result = await db.$queryRaw<{ size: bigint }[]>`
        SELECT pg_database_size(current_database()) as size
      `;
      if (result.length > 0) {
        databaseSizeBytes = Number(result[0].size);
      }
    } catch {}

    return {
      ...overview,
      databaseSizeBytes,
      largestFileCategories,
    };
  }
};
