import { z } from 'zod';

export const createTicketSchema = z.object({
  riderId: z.string().min(1),
  category: z.enum(['TECHNICAL', 'PAYMENT', 'VEHICLE', 'GENERAL', 'TROUBLESHOOTER', 'BATTERY']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
  attachments: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

export const updateTicketSchema = z.object({
  id: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_RIDER', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.union([z.string(), z.null()]).optional(),
  isEscalated: z.boolean().optional(),
  action: z.enum(['escalate']).optional(),
  refundAmountInPaise: z.number().int().nonnegative().optional(),
});

export const ticketReplySchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  attachments: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

export const ticketBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['changeStatus', 'assign', 'changePriority', 'closeResolved', 'revert', 'escalate']),
  value: z.string().optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
  riderId: z.string().min(1).optional(),
});
