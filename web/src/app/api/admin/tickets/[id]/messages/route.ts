import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { validateBody, ticketReplySchema } from '@/lib/validators';
import { supportUseCases } from '@/server/modules/support/support.use-cases';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tickets_resolve')) return adminForbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(ticketReplySchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const newMessage = await supportUseCases.replyToTicket(
      id,
      session.adminId || 'admin',
      'ADMIN',
      validation.data
    );

    return success(newMessage, 'Reply sent successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Ticket not found') {
      return errors.notFound('Ticket not found');
    }
    return errors.internal('Failed to send reply');
  }
}
