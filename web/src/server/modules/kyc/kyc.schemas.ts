/**
 * KYC module - Zod validation schemas.
 */

import { z } from 'zod';
import { submitKycSchema } from '@/lib/validators';

export { submitKycSchema };

export const reviewKycSchema = z.object({
  riderId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
  rejectionReason: z.string().max(500).optional(),
  infoRequest: z.string().max(500).optional(),
});

export type SubmitKycDto = z.infer<typeof submitKycSchema>;
export type ReviewKycDto = z.infer<typeof reviewKycSchema>;
