/**
 * Support module - Types
 *
 * Support ticket, FAQ, and chat types.
 */

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketCategory = 'TECHNICAL' | 'PAYMENT' | 'VEHICLE' | 'GENERAL' | 'TROUBLESHOOTER' | 'BATTERY';

export interface SupportTicket {
  id: string;
  riderId: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  message: string;
  attachments?: string;
  assignedTo?: string;
  assignedName?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: 'rider' | 'admin';
  message: string;
  createdAt: Date;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category?: string;
  order: number;
  isActive: boolean;
}
