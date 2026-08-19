import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q) {
      return errors.badRequest('Search query `q` is required');
    }

    const faqs = await db.faq.findMany({
      where: {
        isActive: true,
        OR: [
          { question: { contains: q, mode: 'insensitive' } },
          { answer: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 3,
      orderBy: { order: 'asc' },
    });

    return success({
      query: q,
      matches: faqs,
      hasMatches: faqs.length > 0,
      fallbackCta: {
        title: 'Need more help?',
        action: 'CREATE_TICKET',
        message: `Couldn't find an answer for "${q}". Would you like to raise a support ticket?`,
      },
    });
  } catch (err) {
    logger.error('[GET /api/support/chat/suggest]', err);
    return errors.internal('Failed to fetch chat suggestions');
  }
}
