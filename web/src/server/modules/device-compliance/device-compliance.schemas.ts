/**
 * Device Compliance module — Zod validation schemas
 */

import { z } from 'zod';

export const syncDeviceStateSchema = z.object({
  riderId: z.string(),
  permissions: z.record(z.string(), z.boolean()),
});

export const reportViolationSchema = z.object({
  riderId: z.string(),
  permissionId: z.string(),
});

export type SyncDeviceStateDto = z.infer<typeof syncDeviceStateSchema>;
export type ReportViolationDto = z.infer<typeof reportViolationSchema>;
