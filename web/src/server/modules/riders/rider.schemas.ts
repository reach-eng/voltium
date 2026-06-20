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
