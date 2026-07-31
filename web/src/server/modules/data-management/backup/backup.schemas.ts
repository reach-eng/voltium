/**
 * Backup Zod schemas — minimal stub.
 * Used by data-management backup routes + tests.
 */

import { z } from 'zod';

export const scheduleUpdateSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'DISABLED']),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  retentionDays: z.number().int().positive().max(365).optional(),
  enabled: z.boolean().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});

export const createBackupSchema = z.object({
  type: z.enum(['FULL', 'INCREMENTAL', 'MANUAL']),
  reason: z.string().optional(),
});

export const backupQuerySchema = z.object({
  type: z.enum(['FULL', 'INCREMENTAL', 'MANUAL']).optional(),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
