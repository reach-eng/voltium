/**
 * Transactions module - Zod validation schemas.
 */

import { z } from 'zod';
import {
  approveTransactionSchema,
  bulkActionSchema,
  topUpSchema,
  transactionBulkActionSchema,
} from '@/lib/validators';

export { approveTransactionSchema, bulkActionSchema, topUpSchema, transactionBulkActionSchema };

// Admin Panel Phase 4 / Batch B (2026-08-23): added `purpose` and
// `audience` so the transactions admin screen can filter by purpose
// (security deposit / rent / topup / etc.) and by origin (user vs
// system-generated). Both are optional (the screen defaults to "all"
// when omitted), but when present they're validated against the
// canonical `TransactionPurpose` / `TransactionAudience` enums to
// keep the filter UI honest about what the DB can actually return.
const TRANSACTION_PURPOSES = [
  'TOP_UP',
  'SECURITY_DEPOSIT',
  'RENT_PAYMENT',
  'REWARD',
  'REFUND',
  'REVERSAL',
  'ADMIN_ADJUSTMENT',
  'FORFEITURE',
  'ONBOARDING',
] as const;

const TRANSACTION_AUDIENCES = ['USER', 'SYSTEM'] as const;

export const transactionQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  purpose: z.enum(TRANSACTION_PURPOSES).optional(),
  audience: z.enum(TRANSACTION_AUDIENCES).optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  riderId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export type TransactionQueryDto = z.infer<typeof transactionQuerySchema>;
export type ApproveTransactionDto = z.infer<typeof approveTransactionSchema>;
export type BulkActionDto = z.infer<typeof bulkActionSchema>;
