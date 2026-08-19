import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { legalUseCases } from '@/server/modules/legal/legal.use-cases';

// Public by design (2026-08-05 legal/device audit P0-3): the rider legal
// screen renders BEFORE login during onboarding, so this route must not
// require a session. The content is non-sensitive (terms/privacy/refund/
// lease) and the rider app treats it as cacheable — a 300s browser cache
// matches the "docs change rarely" profile without a stale legal wall.
export async function GET(request: NextRequest) {
  try {
    const documents = await legalUseCases.list();
    return withCacheHeaders(
      success(
        documents.map((d: { type: string; title: string; content: string; updatedAt: Date }) => ({
          type: d.type,
          title: d.title,
          content: d.content,
          updatedAt: d.updatedAt.toISOString(),
        }))
      ),
      300
    );
  } catch (error) {
    logger.error('GET /api/rider/legal error:', error);
    return errors.internal('Failed to fetch legal documents');
  }
}
