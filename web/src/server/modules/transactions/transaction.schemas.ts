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

export const transactionQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
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
