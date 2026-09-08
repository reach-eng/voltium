/**
 * Riders module - Zod validation schemas.
 */

import { z } from 'zod';
import { updateProfileSchema } from '@/lib/validators';

export { updateProfileSchema };

export const updateRiderSchema = z.object({
  id: z.string().min(1),
  guarantorStatus: z
    .enum(['PENDING', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED', 'REPLACED'])
    .nullable()
    .optional(),
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  // NET-005 follow-up-20 (2026-09-08):
  // `tlAction` removed. The route's
  // `updateRiderSchema` (in
  // `app/api/admin/riders/route.ts`) is
  // the one that actually validates admin
  // rider updates, and it never had
  // `tlAction`. This module's schema is
  // imported by the rider-app profile
  // update (a different route), where
  // `tlAction` was always dead code. The
  // TL-change-request feature was designed
  // but never built; a follow-up ticket
  // should add it (with its own dedicated
  // schema + route, not as a rider-app
  // profile field).
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const getRiderQuerySchema = z.object({
  riderId: z.string().optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type UpdateRiderDto = z.infer<typeof updateRiderSchema>;
export type GetRiderQueryDto = z.infer<typeof getRiderQuerySchema>;
