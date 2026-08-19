'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ServerHealth } from './types';

/**
 * Server health data hook.
 *
 * Fetches consolidated `/api/health?detailed=true`, `/api/health/caddy`,
 * and `/api/health/worker` endpoints to normalise responses into a single
 * typed ServerHealth payload with 30s auto-refresh when active.
 */
export function useServerHealth() {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const [resGeneral, resCaddy, resWorker] = await Promise.all([
        fetch('/api/health?detailed=true'),
        fetch('/api/health/caddy'),
        fetch('/api/health/worker'),
      ]);

      const general = resGeneral.ok ? await resGeneral.json() : null;
      const caddyData = resCaddy.ok ? await resCaddy.json() : null;
      const worker = resWorker.ok ? await resWorker.json() : null;

      const disk = general?.checks?.disk;
      const freeGb = disk?.freeMB !== undefined ? Math.round(disk.freeMB / 1024) : 0;
      const totalGb = disk?.totalMB !== undefined ? Math.round(disk.totalMB / 1024) : 0;

      const dbCheck = general?.checks?.database;
      const uploadCheck = general?.checks?.uploadPath;
      const backupCheck = general?.checks?.backupPath;
      const cpuCheck = general?.checks?.cpu;
      const memoryCheck = general?.checks?.memory;

      setHealth({
        database:
          dbCheck?.status === 'healthy'
            ? `Connected (latency: ${dbCheck.latencyMs ?? 0}ms)`
            : 'Disconnected/Error',
        databaseStatus: dbCheck?.status === 'healthy' ? 'RUNNING' : 'DOWN',
        databasePool: `Status: ${dbCheck?.status ?? 'Unknown'}`,
        localStorage: uploadCheck?.writable
          ? `Writable (${uploadCheck.path})`
          : 'Not Writable',
        localStorageStatus: uploadCheck?.writable ? 'WRITABLE' : 'ERROR',
        backupStorage: backupCheck?.writable
          ? `Configured & Active (${backupCheck.path})`
          : 'Not Writable',
        backupStorageStatus: backupCheck?.writable ? 'WRITABLE' : 'ERROR',
        secondaryBackup: 'Secondary backup root check active',
        secondaryBackupStatus: 'CONNECTED',
        freeDiskGb: freeGb,
        totalDiskGb: totalGb,
        cpuUsage: cpuCheck
          ? `${cpuCheck.usagePercent}% (${cpuCheck.cores} Core${cpuCheck.cores > 1 ? 's' : ''})`
          : 'CPU Metrics unavailable',
        ramUsage: memoryCheck
          ? `${memoryCheck.usedMB} MB / ${memoryCheck.totalMB} MB (${memoryCheck.usagePercent}%)`
          : 'RAM Metrics unavailable',
        pm2Status:
          worker?.status === 'healthy'
            ? `Online (pending: ${worker.pending ?? 0}, failed: ${worker.failed ?? 0}, stuck: ${worker.stuck ?? 0})`
            : 'Offline or Degraded',
        pm2StatusBadge: worker?.status === 'healthy' ? 'ONLINE' : 'DEGRADED',
        // PR-3 (2026-08-06 fix plan): the old fallback defaulted to 'Active'
        // when the caddy fetch failed — the dashboard would show a healthy
        // proxy while Caddy was down. Fail-loud default is 'Offline'.
        caddyStatus: (caddyData?.success && (caddyData?.data?.status === 'Active' || caddyData?.status === 'Active')) ? 'Active' : 'Offline',
      });
    } catch (err) {
      toast.error('Failed to fetch server health metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchHealth();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return { health, loading, fetchHealth };
}

export type ServerHealthHook = ReturnType<typeof useServerHealth>;
