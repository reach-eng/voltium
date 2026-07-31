export interface Ticket {
  id: string;
  ticketId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  status: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderType: string;
  message: string;
  attachments: string | null;
  createdAt: string;
}

export const STATUS_FLOW = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
