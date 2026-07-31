/**
 * R3.7i split — Server Health types.
 *
 * ServerHealth was an inline `any` in ServerHealthScreen.tsx. Extracted
 * so the data hook can build a typed payload, the three cards can
 * consume the same shape, and the orchestrator can stay slim.
 */

export interface ServerHealth {
  // PostgreSQL
  database: string;
  databaseStatus: 'RUNNING' | 'DOWN' | '—';
  databasePool: string;
  // Storage
  localStorage: string;
  localStorageStatus: 'WRITABLE' | 'ERROR' | '—';
  backupStorage: string;
  backupStorageStatus: 'WRITABLE' | 'ERROR' | '—';
  secondaryBackup: string;
  secondaryBackupStatus: 'CONNECTED' | 'DISCONNECTED' | 'N/A' | '—';
  // Hardware
  freeDiskGb: number | '—';
  totalDiskGb: number | '—';
  cpuUsage: string;
  ramUsage: string;
  // Workers
  pm2Status: string;
  pm2StatusBadge: 'ONLINE' | 'DEGRADED' | '—';
  // Proxy
  caddyStatus: 'Active' | '—';
}
