/**
 * POST /api/support/feedback — Submit app/service feedback from rider
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { z } from 'zod';
import { validateBody } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { createAuditLog } from '@/lib/audit-log';

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().default(''),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const validation = validateBody(feedbackSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { rating, comment } = validation.data;

    // Log feedback submission to audit log
    await createAuditLog({
      action: 'FEEDBACK_SUBMITTED',
      entity: 'RiderFeedback',
      entityId: riderDbId,
      actorId: riderDbId,
      actorType: 'RIDER',
      details: {
        rating,
        comment,
        submittedAt: new Date().toISOString(),
      },
    });

    logger.info('[POST /api/support/feedback] Feedback submitted', {
      riderId: riderDbId,
      rating,
    });

    return success(
      { rating, comment, received: true },
      'Thank you for your feedback!'
    );
  } catch (err) {
    logger.error('[POST /api/support/feedback]', err);
    return errors.internal('Failed to submit feedback');
  }
}
