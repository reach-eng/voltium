/**
 * Rentals module - Zod validation schemas.
 */

import { z } from 'zod';
import { subscribePlanSchema } from '@/lib/validators';

export { subscribePlanSchema };

export const startRentalSchema = z.object({
  riderId: z.string().min(1),
  vehicleId: z.string().min(1),
  hubId: z.string().min(1),
  teamLeader: z.string().min(1),
});

export const endRentalSchema = z.object({
  riderId: z.string().min(1),
  returnPhotos: z.array(z.string().url()).min(1, 'At least one return photo required'),
  returnReason: z.string().min(5).max(500),
});

export type SubscribePlanDto = z.infer<typeof subscribePlanSchema>;
export type StartRentalDto = z.infer<typeof startRentalSchema>;
export type EndRentalDto = z.infer<typeof endRentalSchema>;
