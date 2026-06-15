/**
 * Deposits module - Zod validation schemas.
 */

import { z } from 'zod';

export const submitDepositSchema = z.object({
  riderId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  proofUrl: z.string().url('Valid proof URL required'),
});

export const reviewDepositSchema = z.object({
  riderId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(500).optional(),
});

export type SubmitDepositDto = z.infer<typeof submitDepositSchema>;
export type ReviewDepositDto = z.infer<typeof reviewDepositSchema>;
