/**
 * Backup Zod schemas.
 * Used by data-management backup routes + tests.
 */

import { z } from 'zod';

export const scheduleUpdateSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'DISABLED']),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  retentionDays: z.number().int().positive().max(365).optional(),
  enabled: z.boolean().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  primaryBackupRoot: z.string().min(1),
  secondaryBackupRoot: z.string().nullable().optional(),
  keepDaily: z.number().int().min(0).default(7),
  keepWeekly: z.number().int().min(0).default(4),
  keepMonthly: z.number().int().min(0).default(6),
  minimumFreeDiskGb: z.number().int().min(0).default(20),
  includeDatabase: z.boolean().default(true),
  includeUploads: z.boolean().default(true),
});

export const createBackupSchema = z.object({
  type: z.enum(['FULL', 'INCREMENTAL', 'MANUAL', 'SCHEDULED', 'PRE_RESTORE']).default('MANUAL'),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const backupQuerySchema = z.object({
  type: z.enum(['FULL', 'INCREMENTAL', 'MANUAL', 'SCHEDULED', 'PRE_RESTORE']).optional(),
  status: z.enum(['COMPLETED', 'FAILED', 'IN_PROGRESS', 'QUEUED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const restoreValidateSchema = z.object({
  backupId: z.string().min(1),
});

export const restoreStartSchema = z.object({
  backupId: z.string().min(1),
  confirmation: z.literal('RESTORE VOLTIUM'),
  otp: z.string().length(6).optional(),
});
