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

function getCorrelationId(request: NextRequest): string {
  return request.headers.get('x-correlation-id') || 'unknown';
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

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
        exists: result.exists,
        otp: result.otp,
      },
      result.exists
        ? 'Welcome back! Please enter the OTP to login.'
        : 'OTP requested successfully and is being delivered',
      200,
      undefined,
      { correlationId }
    );
    response.headers.set('Api-Version', API_VERSION);
    return response;
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return errors.tooManyRequests(err.message, { correlationId });
    }
    logger.error('[POST /api/auth/send-otp]', { correlationId, error: err });
    const response = errors.internal('Failed to process OTP request. Please check your network.', {
      correlationId,
    });
    response.headers.set('Api-Version', API_VERSION);
    return response;
  }
}
