import { z } from 'zod';

export const topUpSchema = z.object({
  riderId: z.string().optional(),
  amount: z.number().positive('Amount must be positive').max(50000, 'Max ₹50,000 per top-up'),
  purpose: z.enum(['TOP_UP', 'SECURITY_DEPOSIT']),
  method: z.enum(['UPI', 'CASH', 'CARD']),
  reason: z.string().max(200).optional(),
  upiRef: z.string().max(50).optional().nullable(),
  proofUrl: z.string().min(1, 'Proof of payment is required'),
});

export const approveTransactionSchema = z.object({
  id: z.string().min(1),
  // REVERT is deprecated — use REVERSE (creates an offsetting ledger entry, terminal state)
  action: z.enum(['APPROVE', 'REJECT', 'REVERSE']),
  rejectionReason: z.string().max(200).optional(),
  walletCreditAmount: z.number().positive().optional(),
});

export const transactionBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});
