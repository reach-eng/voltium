/**
 * Guarantors module - Zod validation schemas.
 *
 * Re-exports the canonical submitGuarantorSchema from src/lib/validators
 * and defines admin review schemas.
 */

import { z } from 'zod';
import { submitGuarantorSchema } from '@/lib/validators';

export { submitGuarantorSchema };

export const reviewGuarantorSchema = z.object({
  riderId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
  rejectionReason: z.string().max(500).optional(),
  infoRequest: z.string().max(500).optional(),
});

export type SubmitGuarantorDto = z.infer<typeof submitGuarantorSchema>;
export type ReviewGuarantorDto = z.infer<typeof reviewGuarantorSchema>;
