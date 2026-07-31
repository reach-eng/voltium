import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { getOrSetResponse } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
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
