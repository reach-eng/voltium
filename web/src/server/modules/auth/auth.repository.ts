/**
 * Auth module - Repository.
 *
 * Data access for OTP entries, sessions, and rider auth records.
 */

import { db } from '@/lib/db';
import { generateOtp as generateStoredOtp, verifyOtp as verifyStoredOtp } from '@/lib/otp-store';
import type { OtpEntry } from './auth.types';

export const authRepository = {
  async findRiderByPhone(phone: string) {
    return db.rider.findUnique({ where: { phone } });
  },

  async createRider(phone: string, referralCode?: string) {
    const generatedReferralCode =
      referralCode || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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

  async saveOtp(phone: string, otp: string): Promise<void> {
    // Compatibility method: OTP creation is centralized in otp-store.
    // If a caller passes an OTP, otp-store cannot force a specific code without weakening security,
    // so this method generates/stores a fresh OTP and logs only the last four digits of the phone.
    await generateStoredOtp(phone);
  },

  async getOtp(phone: string): Promise<OtpEntry | null> {
    // Compatibility method for legacy callers. The secure store never exposes OTP codes.
    // Return null to force callers to use verifyOtp through otp-store instead of reading codes.
    return null;
  },

  async verifyOtp(phone: string, otp: string) {
    return verifyStoredOtp(phone, otp);
  },
};
