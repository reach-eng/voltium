/**
 * Support module - Zod validation schemas.
 */

import { z } from 'zod';
import { createTicketSchema, updateTicketSchema, ticketReplySchema, chatMessageSchema } from '@/lib/validators';

export { createTicketSchema, updateTicketSchema, ticketReplySchema, chatMessageSchema };

export const supportQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  category: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateTicketDto = z.infer<typeof createTicketSchema>;
export type UpdateTicketDto = z.infer<typeof updateTicketSchema>;
export type TicketReplyDto = z.infer<typeof ticketReplySchema>;
export type SupportQueryDto = z.infer<typeof supportQuerySchema>;
