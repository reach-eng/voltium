import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, sendOtpSchema } from '@/lib/validators';
import { verifyOtp } from '@/lib/otp-store';
import { issueVerifyReceipt } from '@/lib/verify-receipt';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { redactPii } from '@/lib/pii-redact';
import { IS_PROD } from '@/lib/env';
import { z } from 'zod';

const verifyPhoneSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const VERIFY_PHONE_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxRequests: IS_PROD ? 10 : 100,
  failClosed: true,
};

const DAILY_AUTH_IP_RATE_LIMIT = {
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: IS_PROD ? 100 : 1000,
  failClosed: true,
};

// POST /api/auth/verify-phone — Verify OTP without creating a rider or setting a session
export async function POST(request: NextRequest) {
  try {
    const clientIp = rateLimitIdentifierFromRequest(request).replace(/^ip:/, '');

    const dailyIpRl = await checkRateLimit(`daily-auth:ip:${clientIp}`, DAILY_AUTH_IP_RATE_LIMIT);
    if (!dailyIpRl.allowed) {
      return errors.tooManyRequests('Daily authentication attempt limit exceeded for this IP. Try again tomorrow.');
    }

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

    // PR-PICKUP-OTP: issue a short-lived HMAC-signed receipt so downstream
    // flows (e.g. pickup emergency contact) can prove server-side that this
    // number was OTP-verified — the gate stops being client-only. TTL is
    // 15 minutes; the pickup route validates phone + expiry on submit.
    return success(
      { verified: true, receipt: issueVerifyReceipt(phone) },
      'Phone verified successfully'
    );
  } catch (err) {
    logger.error('[POST /api/auth/verify-phone]', redactPii(err));
    return errors.internal('Verification failed');
  }
}
