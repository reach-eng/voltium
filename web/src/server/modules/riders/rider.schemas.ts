/**
 * Riders module - Zod validation schemas.
 */

import { z } from 'zod';
import { updateProfileSchema } from '@/lib/validators';

export { updateProfileSchema };

export const updateRiderSchema = z.object({
  id: z.string().min(1),
  guarantorStatus: z
    .enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INFO_REQUIRED'])
    .nullable()
    .optional(),
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  tlAction: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(['APPROVE', 'REJECT']))
    .optional(),
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
