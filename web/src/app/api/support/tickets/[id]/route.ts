import { NextRequest, NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const ticket = await db.supportTicket.findFirst({
      where: {
        id,
        riderId: auth.riderDbId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return errors.notFound('Ticket not found');
    }

    return success(ticket, 'Ticket details fetched');
  } catch (error) {
    logger.error('GET /api/support/tickets/[id] error:', error);
    return errors.internal('Failed to fetch ticket details');
  }
}
