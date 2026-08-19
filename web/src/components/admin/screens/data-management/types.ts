/**
 * Shared types for Data Management admin tab components.
 */

export interface OverviewData {
  stats: {
    totalBackups: number;
    totalSizeBytes: number;
    lastBackupDate: string | null;
    lastBackupStatus: string | null;
    lastBackupVerified?: boolean;
    activeSchedule: boolean;
  };
  scheduleStatus: {
    enabled: boolean;
    frequency: string;
    nextRunAt: string | null;
    primaryBackupRoot: string;
    secondaryBackupRoot: string | null;
  };
  storage: {
    totalDiskBytes: number;
    freeDiskBytes: number;
    usedDiskBytes: number;
  };
  maintenanceMode: boolean;
}

export interface BackupJobData {
  id: string;
  backupId: string;
  type: 'SCHEDULED' | 'MANUAL' | 'PRE_RESTORE';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  includeDatabase: boolean;
  includeUploads: boolean;
  includeLogs: boolean;
  primaryBackupRoot: string;
  secondaryBackupRoot?: string | null;
  filesPath: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  startedAt: string;
  completedAt?: string | null;
  triggeredBy: string;
}

export interface BackupScheduleConfig {
  id?: string;
  enabled: boolean;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  timeOfDay: string;
  timezone: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  includeDatabase: boolean;
  includeUploads: boolean;
  includeLogs: boolean;
  primaryBackupRoot: string;
  secondaryBackupRoot?: string | null;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  keepManual: number;
  minimumFreeDiskGb: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

export interface StorageData {
  primary: {
    path: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    backupCount: number;
    backupSizeBytes: number;
  };
  secondary?: {
    path: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    backupCount: number;
    backupSizeBytes: number;
  } | null;
}

export interface TestScheduleResult {
  passed: boolean;
  checks: {
    primaryPathWritable: boolean;
    secondaryPathWritable?: boolean;
    diskSpaceAdequate: boolean;
    databaseReachable: boolean;
  };
  errors: string[];
}

export interface PaginatedResult<T> {
  items?: T[];
  jobs?: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
