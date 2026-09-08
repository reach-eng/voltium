/**
 * GET /api/support/tickets/[id] — Rider ticket detail with full message thread.
 * Scoped to the session rider: cross-rider access returns 404 (no oracle).
 */
import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { supportRepository } from '@/server/modules/support/support.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const ticket = await supportRepository.findByIdWithMessages(id);
    if (!ticket || ticket.riderId !== auth.riderDbId) {
      return errors.notFound('Ticket not found');
    }
    return success({ ticket }, 'Ticket fetched');
  } catch (err) {
    logger.error('[GET /api/support/tickets/[id]]', err);
    return errors.internal('Failed to fetch ticket');
  }
}
