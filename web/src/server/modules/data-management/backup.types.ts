/**
 * Data Management — Types
 *
 * Types for backup and restore operations in the laptop-local architecture.
 */

export type BackupType = 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
export type BackupScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type BackupStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type RestoreStatus = 'QUEUED' | 'VALIDATING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface BackupManifest {
  backupId: string;
  type: BackupType;
  createdAt: string;
  appVersion: string;
  database: string;
  databaseName: string;
  uploadsIncluded: boolean;
  fileCount: number;
  totalSizeBytes: number;
  status: BackupStatus;
  createdBy: string;
}

export interface StorageOverview {
  databaseSizeBytes: number;
  uploadsSizeBytes: number;
  backupsSizeBytes: number;
  logsSizeBytes: number;
  freeDiskBytes: number;
  totalDiskBytes: number;
  largestFileCategories: { category: string; sizeBytes: number }[];
}

export interface BackupScheduleConfig {
  id?: string;
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  timeOfDay: string;         // HH:mm
  timezone: string;
  dayOfWeek: number | null;  // 0-6, Sunday=0
  dayOfMonth: number | null; // 1-28
  includeDatabase: boolean;
  includeUploads: boolean;
  includeLogs: boolean;
  primaryBackupRoot: string;
  secondaryBackupRoot: string | null;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  keepManual: number | null;
  minimumFreeDiskGb: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

export interface CreateBackupInput {
  type: BackupType;
  notes?: string;
}

export interface RestoreValidationResult {
  valid: boolean;
  backupId: string;
  manifest?: BackupManifest;
  errors?: string[];
  warnings?: string[];
}

export interface BackupLogEntry {
  id: string;
  backupId: string;
  type: BackupType;
  status: BackupStatus;
  sizeBytes: number | null;
  fileCount: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: string | null;
}
