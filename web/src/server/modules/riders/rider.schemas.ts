/**
 * Riders module - Zod validation schemas.
 */

import { z } from 'zod';
import { updateProfileSchema } from '@/lib/validators';

export { updateProfileSchema };

export const getRiderQuerySchema = z.object({
  riderId: z.string().optional(),
  phone: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type GetRiderQueryDto = z.infer<typeof getRiderQuerySchema>;

// Admin Panel Phase 2 P1-06 / P1-07 (2026-08-23): the admin-side
// rider update schema covers two operations that aren't on
// the rider self-service path:
//   - Clear/Set guarantor: `guarantorStatus` can be set to
//     null to detach a guarantor, or to a non-null value
//     (PENDING/APPROVED/REJECTED) to record a state change.
//   - Team Leader action: `tlAction` is a one-shot
//     approve/reject decision; case-insensitive input is
//     normalized to the canonical uppercase enum so the
//     downstream state machine sees a single canonical form.
export const updateRiderSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    guarantorStatus: z
      .enum(['PENDING', 'APPROVED', 'REJECTED'])
      .nullable()
      .optional(),
    guarantorName: z.string().optional(),
    guarantorPhone: z.string().optional(),
    tlAction: z.preprocess(
      (v) => (typeof v === 'string' ? v.toUpperCase() : v),
      z.enum(['APPROVE', 'REJECT']).optional()
    ),
  })
  .strict();

export type UpdateRiderDto = z.infer<typeof updateRiderSchema>;
