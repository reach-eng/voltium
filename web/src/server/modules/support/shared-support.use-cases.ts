import { logger } from '@/lib/logger';
import { supportRepository } from './support.repository';
import { notificationService } from '@/lib/notification-service';
import { sanitizeHtml } from '@/lib/sanitize';
import type { TicketReplyDto } from './support.schemas';
import { NotFoundError } from "@/lib/api-error";

export const sharedSupportUseCases = {
  async replyToTicket(
    ticketId: string,
    senderId: string,
    senderType: 'RIDER' | 'ADMIN',
    input: TicketReplyDto
  ) {
    const ticket = await supportRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    const message = await supportRepository.addMessage(
      ticketId,
      senderId,
      senderType,
      sanitizeHtml(input.message),
      input.attachments ?? undefined
    );

    await supportRepository.update(ticketId, { updatedAt: new Date() });

    if (senderType === 'ADMIN') {
      notificationService
        .notifySupportReply(ticket.riderId, ticket.id, ticket.subject)
        .catch((e: unknown) => logger.error('Failed to send notification', e));
    }

    return message;
  },
};
