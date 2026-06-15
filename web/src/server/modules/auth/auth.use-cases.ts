/**
 * Auth module - Use cases.
 *
 * Orchestrates authentication workflows: send OTP, verify OTP, session management.
 * Extracted from src/app/api/auth/send-otp/route.ts and verify-otp/route.ts.
 */

import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { createSessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { generateOtp, verifyOtp as verifyOtpStore } from '@/lib/otp-store';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';
import { auth as firebaseAuth } from '@/lib/firebase-admin';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { flattenRider } from '@/lib/flatten-rider';
import { logger } from '@/lib/logger';
import { getFeatureFlags } from '@/lib/feature-flags';
import type { SendOtpInput, VerifyOtpInput, VerifyOtpResult } from './auth.types';

export const authUseCases = {
  async sendOtp(input: SendOtpInput, options?: { ip?: string; correlationId?: string }) {
    const { phone } = input;
    const fullPhone = phone.length === 10 ? `+91${phone}` : phone;
    const correlationId = options?.correlationId || 'unknown';

    // Rate limit by IP
    if (options?.ip) {
      const rl = await checkRateLimit(`otp:${options.ip}`, AUTH_RATE_LIMIT);
      if (!rl.allowed) {
        throw new RateLimitError('Too many OTP requests. Try again later.');
      }
    }

    // Rate limit by phone
    const phoneRl = await checkRateLimit(`otp:phone:${phone}`, {
      windowMs: 60_000,
      maxRequests: 3,
    });
    if (!phoneRl.allowed) {
      throw new RateLimitError('Too many OTP requests for this number. Wait a minute.');
    }

    const existingRider = await db.rider.findUnique({ where: { phone: fullPhone } });

    // Generate OTP
    const otp = await generateOtp(phone);

    // Send via SMS/Push
    const flags = await getFeatureFlags();
    const message = `Your Ryd verification code is: ${otp}. Do not share this code with anyone.`;

    await OutboxService.emit(OutboxEventTypes.SMS_SEND, {
      phone,
      message,
      channel: flags.enablePushNotifications ? 'push' : 'sms',
    });

    logger.info('[AuthUseCases] OTP sent', { correlationId, phone });

    return {
      exists: !!existingRider,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  },

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const { phone: inputPhone, otp, idToken, referralCode: incomingReferralCode } = input;
    let phone = inputPhone || '';

    // Firebase token verification
    if (idToken) {
      if (!firebaseAuth) {
        throw new Error('Firebase configuration missing on server');
      }
      const decodedToken = await firebaseAuth.verifyIdToken(idToken);
      const firebasePhone = decodedToken.phone_number;
      if (!firebasePhone) throw new Error('Phone number not found in token');
      phone = firebasePhone.replace(/\D/g, '').slice(-10);
    } else {
      // Legacy OTP verification
      if (!phone || !otp) throw new Error('Phone and OTP are required');
      const otpResult = await verifyOtpStore(phone, otp);
      if (!otpResult.valid) throw new Error(otpResult.error || 'Invalid OTP');
    }

    // Find or create rider (concurrency-safe)
    let rider = await db.rider.findUnique({ where: { phone } });
    let isNewRider = false;

    if (!rider) {
      const riderId = `VF-RD-${uuidv4().slice(0, 8).toUpperCase()}`;
      const codeBase = phone.slice(-4).toUpperCase();
      const referralCode = `${codeBase}-${uuidv4().slice(0, 4).toUpperCase()}`;

      try {
        rider = await db.rider.create({
          data: {
            phone,
            riderId,
            fullName: '',
            lifecycleStatus: 'PROFILE_SUBMITTED',
            registrationDoneAt: new Date(),
            referralCode,
            referredBy: incomingReferralCode || null,
          },
        });
        isNewRider = true;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          rider = await db.rider.findUnique({ where: { phone } });
        } else {
          throw e;
        }
      }
    }

    if (!rider) throw new Error('Failed to find or create rider');

    // For new riders, create Wallet record and handle referral rewards
    if (isNewRider) {
      await db.wallet.create({
        data: {
          riderId: rider.id,
          balanceInPaise: 0,
          securityDeposit: 0,
          depositStatus: 'PENDING',
          paymentStreak: 0,
          version: 1,
        },
      });

      // Award referral rewards
      if (incomingReferralCode) {
        try {
          const referrer = await db.rider.findUnique({
            where: { referralCode: incomingReferralCode },
          });
          if (referrer) {
            await db.reward.create({
              data: {
                riderId: referrer.id,
                title: 'Successful Referral',
                points: 500,
              },
            });
          }
        } catch (rewardErr) {
          logger.error('[AuthUseCases] Failed to award referral points', { error: rewardErr });
        }
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
    const token = createSessionToken({
      riderId: rider.riderId,
      riderDbId: rider.id,
      phone: rider.phone,
      role: 'rider',
    });

    return {
      riderId: rider.riderId,
      riderDbId: rider.id,
      phone: rider.phone,
      isNewRider,
      token,
      riderData,
    };
  },

  async logout(riderDbId: string): Promise<void> {
    // TODO: Implement logout (clear session, invalidate tokens)
    logger.info('[AuthUseCases] Logout', { riderDbId });
  },
};

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
