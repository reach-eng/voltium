/**
 * POST /api/auth/send-otp — Send OTP to phone number
 *
 * Thin route: parse input → authenticate → call use-case → respond
 * Business logic lives in authUseCases.sendOtp.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, sendOtpSchema } from '@/lib/validators';
import { authUseCases, RateLimitError } from '@/server/modules/auth/auth.use-cases';
import { API_VERSION } from '@/lib/api-version';
import { logger } from '@/lib/logger';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { redactPii } from '@/lib/pii-redact';

function getCorrelationId(request: NextRequest): string {
  return request.headers.get('x-correlation-id') || 'unknown';
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const clientIp = rateLimitIdentifierFromRequest(request).replace(/^ip:/, '');

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body', { correlationId });
    }

    const validation = validateBody(sendOtpSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error!, { correlationId });
    }

    const result = await authUseCases.sendOtp(validation.data, { ip: clientIp, correlationId });

    const response = success(
      {
        // PR-52 (GDPR): `exists` removed from the send-otp response —
        // account-existence is never leaked to the client.
        otp: result.otp,
      },
      'OTP requested successfully and is being delivered',
      200,
      undefined,
      { correlationId }
    );
    response.headers.set('Api-Version', API_VERSION);
    return response;
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return errors.tooManyRequests((err instanceof Error ? err.message : String(err)), { correlationId });
    }
    logger.error('[POST /api/auth/send-otp]', { correlationId, error: redactPii(err) });
    const response = errors.internal('Failed to process OTP request. Please check your network.', {
      correlationId,
    });
    response.headers.set('Api-Version', API_VERSION);
    return response;
  }
}
