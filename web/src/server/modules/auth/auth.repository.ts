/**
 * Auth module - Repository.
 *
 * Data access for OTP entries, sessions, and rider auth records.
 */

import { db } from '@/lib/db';
import type { OtpEntry } from './auth.types';

export const authRepository = {
  async findRiderByPhone(phone: string) {
    return db.rider.findUnique({ where: { phone } });
  },

  async createRider(phone: string, referralCode?: string) {
    const generatedReferralCode = referralCode || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const generatedRiderId = `RIDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return db.rider.create({
      data: {
        riderId: generatedRiderId,
        phone,
        fullName: '',
        referredBy: referralCode || null,
        referralCode: generatedReferralCode,
      },
    });
  },

  // TODO: Move OTP storage to Redis/cache layer when available
  async saveOtp(phone: string, otp: string): Promise<void> {
    // Placeholder — should use Redis with TTL
    throw new Error('Not implemented');
  },

  async getOtp(phone: string): Promise<OtpEntry | null> {
    throw new Error('Not implemented');
  },
};
