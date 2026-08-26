import { supportUseCases } from './support.use-cases';
import { createAuditLog } from '@/lib/audit-log';

export const adminSupportUseCases = {
  updateTicket: supportUseCases.updateTicket,
  replyToTicket: supportUseCases.replyToTicket,
  getTicket: supportUseCases.getTicket,
  async logAdminAction(adminId: string, input: { action: string; ticketId: string; details?: any }) {
    await createAuditLog({
      actorId: adminId,
      action: input.action,
      entity: 'ticket',
      entityId: input.ticketId,
      details: input.details,
    });
  },
};
