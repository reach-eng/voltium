import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, sendOtpSchema } from '@/lib/validators';
import { verifyOtp } from '@/lib/otp-store';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const verifyPhoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const VERIFY_PHONE_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'development' ? 100 : 10,
};

// POST /api/auth/verify-phone — Verify OTP without creating a rider or setting a session
export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const ipRl = await checkRateLimit(`verify-phone-ip:${clientIp}`, VERIFY_PHONE_RATE_LIMIT);
    if (!ipRl.allowed) {
      return errors.tooManyRequests('Too many attempts. Try again later.');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    const validation = validateBody(verifyPhoneSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { phone, otp } = validation.data;

    const phoneRl = await checkRateLimit(`verify-phone:${phone}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!phoneRl.allowed) {
      return errors.tooManyRequests('Too many attempts for this number. Try again later.');
    }

    const otpResult = await verifyOtp(phone, otp);
    if (!otpResult.valid) {
      return errors.unauthorized(otpResult.error || 'Invalid OTP');
    }

    return success({ verified: true }, 'Phone verified successfully');
  } catch (err) {
    logger.error('[POST /api/auth/verify-phone]', err);
    return errors.internal('Verification failed');
  }
}
