import { NextRequest, NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, feedbackSchema } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const validation = validateBody(feedbackSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const { rating, comment } = validation.data;

    const ticket = await db.supportTicket.create({
      data: {
        riderId: auth.riderDbId,
        category: 'FEEDBACK',
        subject: `App Feedback: ${rating}/5 Stars`,
        description: comment || `Rating: ${rating}/5 Stars`,
        status: 'RESOLVED',
        priority: 'LOW',
      },
    });

    return success({ id: ticket.id, rating, status: ticket.status }, 'Feedback submitted successfully', 201);
  } catch (error) {
    logger.error('POST /api/support/feedback error:', error);
    return errors.internal('Failed to submit feedback');
  }
}
