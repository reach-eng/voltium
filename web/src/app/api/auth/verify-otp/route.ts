import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, verifyOtpSchema } from '@/lib/validators';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { authUseCases } from '@/server/modules/auth/auth.use-cases';
import { onboardingUseCases } from '@/server/modules/onboarding/onboarding.use-cases';
import { flattenRider } from '@/lib/flatten-rider';
import { createSessionToken } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { API_VERSION } from '@/lib/api-version';

const OTP_VERIFY_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'development' ? 100 : 5,
};

const OTP_VERIFY_IP_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'development' ? 200 : 15,
};

const TEST_PHONES = ['9876543210', '9999999999', '8888888888'];

function getCorrelationId(request: NextRequest): string {
  return request.headers.get('x-correlation-id') || 'unknown';
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    let body;
    try { body = await request.json(); } catch {
      return errors.badRequest('Invalid request body', { correlationId });
    }

    const validation = validateBody(verifyOtpSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error, { correlationId });
    }

    const { phone: inputPhone } = validation.data;
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    const ipRateLimit = await checkRateLimit(`otp-verify-ip:${clientIp}`, OTP_VERIFY_IP_RATE_LIMIT);
    if (!ipRateLimit.allowed) {
      return errors.tooManyRequests(
        `Too many attempts from this IP. Try again in ${Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)}s`,
        { correlationId, rateLimit: { limit: OTP_VERIFY_IP_RATE_LIMIT.maxRequests, remaining: 0, resetAt: ipRateLimit.resetAt } }
      );
    }

    const rateLimit = await checkRateLimit(`otp-verify:${inputPhone}`, OTP_VERIFY_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return errors.tooManyRequests(
        `Too many attempts. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s`,
        { correlationId, rateLimit: { limit: OTP_VERIFY_RATE_LIMIT.maxRequests, remaining: 0, resetAt: rateLimit.resetAt } }
      );
    }

    const result = await authUseCases.verifyOtp(validation.data);

    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_TOOLS === 'true' && process.env.TEST_MODE === 'true' && TEST_PHONES.includes(result.phone)) {
      const rider = await onboardingUseCases.autoProvisionTestRider(result.riderDbId, result.phone);
      if (rider) {
        const flatRider = flattenRider(rider);
        const sessionToken = createSessionToken({ riderId: rider.riderId, riderDbId: rider.id, phone: rider.phone, role: 'rider' });
        const resp = success({ ...flatRider, token: sessionToken }, 'OTP verified successfully', 200, undefined, { correlationId });
        resp.headers.set('Api-Version', API_VERSION);
        resp.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
        return resp;
      }
    }

    const response = success(
      { ...result.riderData, token: result.token },
      'OTP verified successfully', 200, undefined, { correlationId }
    );
    response.headers.set('Api-Version', API_VERSION);
    response.cookies.set(SESSION_COOKIE_NAME, result.token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (err: any) {
    logger.error('[POST /api/auth/verify-otp]', { correlationId, error: err });
    const response = errors.internal('Verification failed. Please check your connection or try again.', { correlationId });
    response.headers.set('Api-Version', API_VERSION);
    return response;
  }
}
