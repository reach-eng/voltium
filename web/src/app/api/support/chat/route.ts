import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextRequest } from 'next/server';
import { errors } from '@/lib/api-response';
import { buildSystemPrompt } from '@/lib/chat-system-prompt';
import { logger } from '@/lib/logger';
import { validateBody, chatMessageSchema } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { checkRateLimit } from '@/lib/rate-limit';

const CHAT_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: process.env.NODE_ENV === 'development' ? 100 : 10, // 10 messages per minute
};

export const maxDuration = 30; // Vercel Edge function max

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const clientIp =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(`chat:${clientIp}`, CHAT_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return errors.tooManyRequests(
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s`
      );
    }

    const body = await request.json();
    const validation = validateBody(chatMessageSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { message } = validation.data;

    // Check for critical keywords and prepend urgent warning if found
    const criticalKeywords = [
      'accident',
      'crash',
      'injury',
      'fire',
      'emergency',
      'stolen',
      'theft',
      'assault',
      'police',
      'hurt',
      'bleeding',
    ];
    const isCritical = criticalKeywords.some((kw) => message.toLowerCase().includes(kw));

    const systemPrompt = buildSystemPrompt();

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt: message,
      maxOutputTokens: 500,
      temperature: 0.7,
      onFinish: ({ text }) => {
        logger.info('Chat completed', { riderId: riderDbId, responseLength: text.length });
      },
    });

    // Return as a text stream (not data stream — simpler for client consumption)
    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Critical-Flag': isCritical ? 'true' : 'false',
      },
    });
  } catch (err) {
    logger.error('[POST /api/support/chat]', err);
    return errors.internal('Failed to process chat message');
  }
}
