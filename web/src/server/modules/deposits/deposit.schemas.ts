/**
 * Deposits module - Zod validation schemas.
 */

import { z } from 'zod';

export const submitDepositSchema = z.object({
  riderId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  // PR-ONBOARDING-2026-08-11 (audit 2.18): proofUrl is no longer a
  // DepositRecord column. The proof is on the linked Transaction row
  // (`Transaction.proofUrl`); callers should send the proof on the
  // top-up / transaction request, not on the deposit submit. Removing
  // the field here breaks the dead deposit.routes.ts handler; remove
  // it from the use-case + repository as well in the same PR.
});

export const reviewDepositSchema = z.object({
  riderId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(500).optional(),
});

export type SubmitDepositDto = z.infer<typeof submitDepositSchema>;
export type ReviewDepositDto = z.infer<typeof reviewDepositSchema>;
