import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { supportUseCases } from '@/server/modules/support/support.use-cases';

export async function GET(request: NextRequest) {
  try {
    const faqs = await supportUseCases.getFAQs();
    return success({ faqs }, `${faqs.length} FAQs fetched successfully`);
  } catch (err) {
    logger.error('[GET /api/support/faqs]', err);
    return errors.internal('Failed to fetch FAQs');
  }
}
