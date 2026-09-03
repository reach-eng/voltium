import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { getOrSetResponse } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const identifier = rateLimitIdentifierFromRequest(request);
    const rl = await checkRateLimit(`public:faqs:${identifier}`, {
      windowMs: 60_000,
      maxRequests: 60,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many requests. Please try again later.');
    }

    const faqs = await getOrSetResponse(
      'support_faqs',
      () => supportUseCases.getFAQs(),
      3600
    );
    return success({ faqs }, `${faqs?.length || 0} FAQs fetched successfully`);
  } catch (err) {
    logger.error('[GET /api/support/faqs]', err);
    return errors.internal('Failed to fetch FAQs');
  }
}
