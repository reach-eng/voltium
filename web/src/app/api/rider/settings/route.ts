import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { settingUseCases } from '@/server/modules/settings/setting.use-cases';

export async function GET(request: NextRequest) {
  try {
    // P2-6 (review, 2026-09-07): sibling public endpoints — faqs
    // (60/min), chat-suggest (30/min), feedback (10/min) — all have a
    // rate limit; rider settings GET was the odd one out. The
    // endpoint is cheap, but consistency is free. The limit is
    // keyed on the rider's session id (the `requireRiderSession`
    // call below means a missing/invalid session won't even reach
    // the limiter, so an anonymous flood costs the auth path,
    // not the rate-limit budget).
    const identifier = rateLimitIdentifierFromRequest(request);
    const rl = await checkRateLimit(`rider:settings:${identifier}`, {
      windowMs: 60_000,
      maxRequests: 60,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many requests. Please try again later.');
    }

    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const result = await settingUseCases.getPublic();
    return success(result);
  } catch (err) {
    return errors.internal('Failed to fetch settings');
  }
}
