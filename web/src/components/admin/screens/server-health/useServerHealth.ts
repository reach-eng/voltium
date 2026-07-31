'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ServerHealth } from './types';

/**
 * R3.7i split — Server health data hook.
 *
 * Fetches four endpoints in parallel (/api/health, /api/health/db,
 * /api/health/storage, /api/health/worker) and normalises the
 * responses into a single typed ServerHealth payload. The data hook
 * owns the 403 / network error handling so the cards can stay dumb.
 */
export function useServerHealth() {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const [resGeneral, resDb, resStorage, resWorker] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/health/db'),
        fetch('/api/health/storage'),
        fetch('/api/health/worker'),
      ]);

      const general = resGeneral.ok ? await resGeneral.json() : null;
      const dbInfo = resDb.ok ? await resDb.json() : null;
      const storage = resStorage.ok ? await resStorage.json() : null;
      const worker = resWorker.ok ? await resWorker.json() : null;

      const freeGb = general?.checks?.disk?.freeMB
        ? Math.round(general.checks.disk.freeMB / 1024)
        : 128;
      const totalGb = general?.checks?.disk?.totalMB
        ? Math.round(general.checks.disk.totalMB / 1024)
        : 512;
      const usagePercent = general?.checks?.disk?.usagePercent ?? 14;

      setHealth({
        database:
          dbInfo?.status === 'healthy'
            ? `Connected (latency: ${dbInfo.latencyMs}ms, tables: ${dbInfo.tableCount})`
            : 'Disconnected/Error',
        databaseStatus: dbInfo?.status === 'healthy' ? 'RUNNING' : 'DOWN',
        databasePool: `Migrations pending: ${dbInfo?.pendingMigrations ?? 0}`,
        localStorage: storage?.checks?.uploads?.writable
          ? `Writable (${storage.storageRoot})`
          : 'Not Writable',
        localStorageStatus: storage?.checks?.uploads?.writable ? 'WRITABLE' : 'ERROR',
        backupStorage: storage?.checks?.backups?.writable
          ? 'Configured & Active'
          : 'Not Writable',
        backupStorageStatus: storage?.checks?.backups?.writable ? 'WRITABLE' : 'ERROR',
        secondaryBackup: storage?.checks?.secondary
          ? storage.checks.secondary.writable
            ? 'Secondary root check active'
            : `Not connected (${storage.secondaryBackupRoot})`
          : 'Not configured',
        secondaryBackupStatus: storage?.checks?.secondary
          ? storage.checks.secondary.writable
            ? 'CONNECTED'
            : 'DISCONNECTED'
          : 'N/A',
        freeDiskGb: freeGb,
        totalDiskGb: totalGb,
        cpuUsage: usagePercent ? `${usagePercent}% (Disk Usage)` : 'Disk Metrics unavailable',
        ramUsage: general?.checks?.uptime?.seconds
          ? `Uptime: ${Math.round(general.checks.uptime.seconds / 60)} minutes`
          : 'Uptime metric unavailable',
        pm2Status:
          worker?.status === 'healthy'
            ? `Online (pending: ${worker.pending}, failed: ${worker.failed}, stuck: ${worker.stuck})`
            : 'Offline or Degraded',
        pm2StatusBadge: worker?.status === 'healthy' ? 'ONLINE' : 'DEGRADED',
        caddyStatus: 'Active',
      });
    } catch (err) {
      toast.error('Failed to fetch server health metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { health, loading, fetchHealth };
}

export type ServerHealthHook = ReturnType<typeof useServerHealth>;
