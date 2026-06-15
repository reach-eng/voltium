/**
 * Vehicles module - Zod validation schemas.
 */

import { z } from 'zod';
import { createVehicleSchema, updateVehicleSchema } from '@/lib/validators';

export { createVehicleSchema, updateVehicleSchema };

export const vehicleQuerySchema = z.object({
  hubId: z.string().optional(),
  status: z.string().optional(),
});

export type CreateVehicleDto = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof updateVehicleSchema>;
