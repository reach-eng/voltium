/**
 * Analytics module — Zod validation schemas
 */

import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  entityType: z.enum(['revenue', 'riders', 'fleet', 'all']).default('all'),
});

export type AnalyticsQueryDto = z.infer<typeof analyticsQuerySchema>;
