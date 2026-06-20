/**
 * Support API Contract — request/response DTOs for tickets and chat.
 */

import type { ApiResponseSuccess, ApiPagination } from '@/lib/api-response';

// ── POST /api/support/tickets ─────────────────────────────────────────

export interface CreateTicketRequest {
  category: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  subject: string;
  message: string;
  attachments?: string;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  riderId: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessageResponse[];
}

export interface TicketMessageResponse {
  id: string;
  senderId: string;
  senderType: 'RIDER' | 'ADMIN';
  message: string;
  attachments?: string;
  createdAt: string;
}

// ── POST - Reply ─────────────────────────────────────────────────────

export interface ReplyRequest {
  message: string;
  attachments?: string;
}

// ── Admin - Update Ticket ────────────────────────────────────────────

export interface UpdateTicketRequest {
  id: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedTo?: string;
}

export type CreateTicketApiResponse = ApiResponseSuccess<TicketResponse>;
export type ListTicketsApiResponse = ApiResponseSuccess<TicketResponse[]> & {
  pagination: ApiPagination;
};
