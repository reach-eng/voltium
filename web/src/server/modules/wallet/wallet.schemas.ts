/**
 * Wallet module - Zod validation schemas.
 */

import { z } from 'zod';
import { walletTopupSchema } from '@/lib/validators';

export { walletTopupSchema };

export const approveTopupSchema = z.object({
  transactionId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT', 'REVERSE']),
  rejectionReason: z.string().max(200).optional(),
});

export type WalletTopupDto = z.infer<typeof walletTopupSchema>;
export type ApproveTopupDto = z.infer<typeof approveTopupSchema>;
