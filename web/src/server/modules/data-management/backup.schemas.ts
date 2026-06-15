/**
 * Data Management — Zod Validation Schemas
 */

import { z } from 'zod';

export const createBackupSchema = z.object({
  type: z.enum(['MANUAL', 'SCHEDULED', 'PRE_RESTORE']).default('MANUAL'),
  notes: z.string().optional(),
});

export const backupQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['MANUAL', 'SCHEDULED', 'PRE_RESTORE']).optional(),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
});

export const restoreValidateSchema = z.object({
  backupId: z.string().min(1, 'Backup ID is required'),
});

export const restoreStartSchema = z.object({
  backupId: z.string().min(1, 'Backup ID is required'),
  confirmation: z.string().refine((v) => v === 'RESTORE VOLTIUM', {
    message: 'Type RESTORE VOLTIUM to confirm',
  }),
  otp: z.string().length(6).optional(),
});

export const scheduleUpdateSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('DAILY'),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:mm format').default('02:00'),
  timezone: z.string().default('Asia/Kolkata'),
  dayOfWeek: z.number().int().min(0).max(6).nullable().default(null),
  dayOfMonth: z.number().int().min(1).max(28).nullable().default(null),
  includeDatabase: z.boolean().default(true),
  includeUploads: z.boolean().default(true),
  includeLogs: z.boolean().default(false),
  primaryBackupRoot: z.string().min(1, 'Primary backup path is required'),
  secondaryBackupRoot: z.string().nullable().default(null),
  keepDaily: z.number().int().positive().max(365).default(7),
  keepWeekly: z.number().int().positive().max(52).default(4),
  keepMonthly: z.number().int().positive().max(24).default(6),
  keepManual: z.number().int().nonnegative().nullable().default(null),
  minimumFreeDiskGb: z.number().int().positive().default(20),
});

export const scheduleTestSchema = z.object({});

