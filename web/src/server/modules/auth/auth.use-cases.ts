/**
 * Auth module - Use cases.
 *
 * Orchestrates authentication workflows: send OTP, verify OTP, session management.
 * Extracted from src/app/api/auth/send-otp/route.ts and verify-otp/route.ts.
 */

import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { createSessionToken, createRefreshToken } from '@/lib/auth';
import { generateOtp, verifyOtp as verifyOtpStore } from '@/lib/otp-store';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';
import { auth as firebaseAuth } from '@/lib/firebase-admin';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { flattenRider } from '@/lib/flatten-rider';
import { logger } from '@/lib/logger';
import { getFeatureFlags } from '@/lib/feature-flags';
import { env } from '@/lib/env';
import { invalidateRiderCache } from '@/lib/server-cache';
import type { SendOtpInput, VerifyOtpInput, VerifyOtpResult } from './auth.types';

export const authUseCases = {
  async sendOtp(input: SendOtpInput, options?: { ip?: string; correlationId?: string }) {
    const { phone: inputPhone } = input;
    const tenDigitPhone = inputPhone.replace(/\D/g, '').slice(-10);
    const fullPhone = `+91${tenDigitPhone}`;
    const correlationId = options?.correlationId || 'unknown';

    // Rate limit by IP
    if (options?.ip) {
      const rl = await checkRateLimit(`otp:${options.ip}`, AUTH_RATE_LIMIT);
      if (!rl.allowed) {
        throw new RateLimitError('Too many OTP requests. Try again later.');
      }
    }

    // Rate limit by phone
    const phoneRl = await checkRateLimit(`otp:phone:${tenDigitPhone}`, {
      windowMs: 60_000,
      maxRequests: 3,
    });
    if (!phoneRl.allowed) {
      throw new RateLimitError('Too many OTP requests for this number. Wait a minute.');
    }

    const existingRider = await db.rider.findUnique({ where: { phone: fullPhone } });

    // Generate OTP
    const otp = await generateOtp(tenDigitPhone);

    // Send via SMS/Push
    const flags = await getFeatureFlags();
    const message = `Your Voltium verification code is: ${otp}. Do not share this code with anyone.`;

    // @allow-outbox-standalone — the SMS emit has no parent business
    // write to be atomic with. The user already has the OTP (in
    // memory for dev-mode or in the otp-store for prod); the SMS is
    // a best-effort delivery. If the emit fails, the next `sendOtp`
    // retry from the client re-emits.
    await OutboxService.emit(
      OutboxEventTypes.SMS_SEND,
      {
        phone: tenDigitPhone,
        message,
        channel: flags.enablePushNotifications ? 'push' : 'sms',
      },
      3,
      undefined,
      // PR-75: SMS dispatch is interactive — a 1-second job that must
      // not be starved by a 10-minute background cleanup.
      'interactive'
    );

    // PR-52 (GDPR): the `exists` response field was removed — echoing
    // whether a phone number has an account is user enumeration. The lookup
    // above is kept (its result feeds rate-limit/analytics telemetry) but
    // the boolean never reaches the client.
    logger.info('[AuthUseCases] OTP sent', {
      correlationId,
      phone: tenDigitPhone,
      isExistingRider: existingRider !== null,
    });

    return {
      // PR-112 (SEC PR-5): only echo the OTP in dev. APP_ENV=staging is
      // production-grade for this gate (staging receives real SMS), so the
      // echo is suppressed.
      otp:
        process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'development'
          ? otp
          : undefined,
    };
  },

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const { phone: inputPhone, otp, idToken, referralCode: incomingReferralCode } = input;
    let rawPhone = inputPhone || '';

    // Firebase token verification
    if (idToken) {
      if (!firebaseAuth) {
        throw new Error('Firebase configuration missing on server');
      }
      const decodedToken = await firebaseAuth.verifyIdToken(idToken);
      const firebasePhone = decodedToken.phone_number;
      if (!firebasePhone) throw new Error('Phone number not found in token');
      rawPhone = firebasePhone;
    }

    const tenDigitPhone = rawPhone.replace(/\D/g, '').slice(-10);
    if (!tenDigitPhone || !otp) throw new Error('Phone and OTP are required');

    // OTP Verification against tenDigitPhone
    const otpResult = await verifyOtpStore(tenDigitPhone, otp);
    if (!otpResult.valid) throw new Error(otpResult.error || 'Invalid OTP');

    // Find or create rider (concurrency-safe)
    const fullPhone = `+91${tenDigitPhone}`;
    let rider = await db.rider.findUnique({ where: { phone: fullPhone } });
    let isNewRider = false;

    if (!rider) {
      const riderId = `VF-RD-${uuidv4().slice(0, 8).toUpperCase()}`;
      const codeBase = tenDigitPhone.slice(-4).toUpperCase();
      const referralCode = `${codeBase}-${uuidv4().slice(0, 4).toUpperCase()}`;

      try {
        rider = await db.rider.create({
          data: {
            phone: fullPhone,
            riderId,
            fullName: '',
            lifecycleStatus: 'NEW',
            referralCode,
            referredBy: incomingReferralCode || null,
          },
        });
        isNewRider = true;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          rider = await db.rider.findUnique({ where: { phone: fullPhone } });
        } else {
          throw e;
        }
      }
    }

    if (!rider) throw new Error('Failed to find or create rider');

    // For new riders, create Wallet record and handle referral rewards
    if (isNewRider) {
      invalidateRiderCache(rider.id);
      await db.wallet.create({
        data: {
          riderId: rider.id,
          balanceInPaise: 0,
          securityDepositInPaise: 0,
          depositStatus: 'PENDING',
          paymentStreak: 0,
          version: 1,
        },
      });

      // Award referral rewards (PR-116: block self-referral)
      // P0 fix 2026-09-03: signup NO LONGER mints any reward. The old code
      // created Reward{points:500} here immediately on signup (no wallet
      // credit, no idempotency, no ACTIVE gate), while referral.use-cases +
      // referral-reward.job credit ₹200 (20000 paise) via ledger with shared
      // key referral:{referrer}:{referee}. A referred signup therefore got
      // BOTH (double-pay, two amounts) before the referee did anything,
      // contradicting the FAQ. Single money path now: referredBy is stored
      // above; payout happens exactly once via processReferralReward / the
      // referral-reward job when the referee first reaches ACTIVE
      // (rank >= 11), guarded by WalletLedger.idempotencyKey UNIQUE.
      if (incomingReferralCode && incomingReferralCode === rider.referralCode) {
        logger.warn('[AuthUseCases] Self-referral blocked', { riderId: rider.id });
        await db.rider.update({
          where: { id: rider.id },
          data: { referredBy: null },
        });
      }
    }

    // Fetch full rider with relations
    const riderWithRelations = await db.rider.findUnique({
      where: { id: rider.id },
      include: {
        kycProfile: true,
        wallet: true,
        guarantor: true,
        vehicleReturns: true,
      },
    });

    if (!riderWithRelations) throw new Error('Failed to fetch rider data');

    const riderData = flattenRider(riderWithRelations);

    // Create session token
    const token = await createSessionToken({
      riderId: rider.riderId,
      riderDbId: rider.id,
      phone: rider.phone,
      role: 'rider',
      tokenVersion: rider.tokenVersion,
    });

    const refreshToken = await createRefreshToken({
      riderId: rider.riderId,
      riderDbId: rider.id,
      phone: rider.phone,
      role: 'rider',
      tokenVersion: rider.tokenVersion,
    });

    return {
      riderId: rider.riderId,
      riderDbId: rider.id,
      phone: rider.phone,
      isNewRider,
      token,
      refreshToken,
      riderData,
    };
  },

  async logout(riderDbId: string): Promise<void> {
    await db.rider.update({
      where: { id: riderDbId },
      data: { tokenVersion: { increment: 1 } },
    });
    invalidateRiderCache(riderDbId);
    logger.info('[AuthUseCases] Logout (token version incremented)', { riderDbId });
  },
};

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
