import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { validateBody, sendOtpSchema } from '@/lib/validators';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';
import { generateOtp } from '@/lib/otp-store';
import { JobQueue, JobTypes } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { API_VERSION } from '@/lib/api-version';
import { getFeatureFlags } from '@/lib/feature-flags';

function getCorrelationId(request: NextRequest): string {
  return request.headers.get('x-correlation-id') || 'unknown';
}

// POST /api/auth/send-otp - Send OTP to phone number
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    // ── Rate limit by IP ────────────────────────────────────────────
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const rl = await checkRateLimit(`otp:${clientIp}`, AUTH_RATE_LIMIT);
    if (!rl.allowed) {
      logger.warn('OTP Rate Limit hit (IP)', { correlationId, clientIp });
      return errors.tooManyRequests('Too many OTP requests. Try again later.', {
        correlationId,
        rateLimit: { limit: AUTH_RATE_LIMIT.maxRequests, remaining: 0, resetAt: rl.resetAt },
      });
    }

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

    const { phone } = validation.data;
    const fullPhone = phone.length === 10 ? `+91${phone}` : phone;

    const flags = await getFeatureFlags();

    // Check if rider exists
    const existingRider = await db.rider.findUnique({
      where: { phone: fullPhone }
    });

    // Also rate limit by phone number (stricter)
    const phoneRl = await checkRateLimit(`otp:phone:${phone}`, {
      windowMs: 60_000, // 1 minute
      maxRequests: 3,    // max 3 OTP requests per minute per phone
    });
    if (!phoneRl.allowed) {
      logger.warn('OTP Rate Limit hit (Phone)', { correlationId, phone });
      return errors.tooManyRequests('Too many OTP requests for this number. Wait a minute.', {
        correlationId,
        rateLimit: { limit: 3, remaining: 0, resetAt: phoneRl.resetAt },
      });
    }

    // Generate a real OTP with expiry and attempt tracking
    const otp = await generateOtp(phone);

    // Use push notifications if enabled, otherwise fall back to SMS
    const message = `Your Voltium verification code is: ${otp}. Do not share this code with anyone.`;

    if (flags.enablePushNotifications) {
      await JobQueue.enqueue(JobTypes.SEND_SMS, {
        phone,
        message,
        channel: 'push',
      });
    } else {
      await JobQueue.enqueue(JobTypes.SEND_SMS, {
        phone,
        message,
        channel: 'sms',
      });
    }

    logger.info('[POST /api/auth/send-otp] OTP sent successfully', { correlationId, phone });

    const response = success({
      exists: !!existingRider,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    }, existingRider ? 'Welcome back! Please enter the OTP to login.' : 'OTP requested successfully and is being delivered', 200, undefined, {
      correlationId,
      rateLimit: { limit: AUTH_RATE_LIMIT.maxRequests, remaining: rl.remaining, resetAt: rl.resetAt },
    });
    response.headers.set('Api-Version', API_VERSION);
    return response;
  } catch (err) {
    logger.error('[POST /api/auth/send-otp]', { correlationId, error: err });
    const response = errors.internal('Failed to process OTP request. Please check your network.', { correlationId });
    response.headers.set('Api-Version', API_VERSION);
    return response;
  }
}
