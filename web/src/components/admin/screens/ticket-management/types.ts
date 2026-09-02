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
  // AUDIT-RECON 2026-09-02 batch 6 P0-4: comma-separated list of
  // uploaded photo URLs (set by the rider Flutter app via
  // uploadedUrls.where((u) => u.isNotEmpty).join(',')). The
  // server-side supportRepository + supportUseCases now include
  // this in the response; the field was being stripped from the
  // TypeScript shape which is why the admin UI never rendered it.
  attachments: string | null;
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

export interface AdminUser {
  id: string;
  name: string;
}

export interface RiderOption {
  id: string;
  fullName: string;
  riderId: string;
}

export interface LastBulkAction {
  ids: string[];
  previousStates: Record<string, any>;
  action: string;
}

export interface NewTicketForm {
  riderDbId: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
}
