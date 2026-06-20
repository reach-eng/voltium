/**
 * Hubs module - Zod validation schemas.
 */

import { z } from 'zod';
import { createHubSchema, createTeamLeaderSchema } from '@/lib/validators';

export { createHubSchema, createTeamLeaderSchema };

export const updateHubSchema = createHubSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateHubDto = z.infer<typeof createHubSchema>;
export type UpdateHubDto = z.infer<typeof updateHubSchema>;
export type CreateTeamLeaderDto = z.infer<typeof createTeamLeaderSchema>;
