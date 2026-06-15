/**
 * OTP Store — Manages OTP generation, storage, verification, and expiry.
 *
 * In-memory for single-instance / dev. For production multi-instance,
 * swap the store to Redis (same pattern as rate-limit.ts).
 *
 * Each OTP has:
 *   - 6-digit cryptographically random code
 *   - 5-minute expiry
 *   - Max 3 verification attempts
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds between resends
const MAX_RESENDS = 5; // max 5 resend attempts per phone per window

// ─── In-Memory Store ──────────────────────────────────────────────────────

const memoryStore = new Map<string, OtpEntry>();

// ─── Protected API ───────────────────────────────────────────────────────


export function generateRandomOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

/** Track OTP send timestamps per phone for resend limiting */
const resendStore = new Map<string, { count: number; lastSentAt: number }>();
const RESEND_WINDOW_MS = 10 * 60 * 1000; // 10-minute window for resend counting

export async function canResendOtp(phone: string): Promise<{ allowed: boolean; error?: string }> {
  const record = resendStore.get(phone);
  if (!record) return { allowed: true };

  if (Date.now() - record.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - record.lastSentAt)) / 1000);
    return { allowed: false, error: `Please wait ${waitSeconds}s before requesting a new OTP.` };
  }

  if (record.count >= MAX_RESENDS) {
    return { allowed: false, error: 'Too many OTP requests. Please try again later.' };
  }

  return { allowed: true };
}

export async function generateOtp(phone: string): Promise<string> {
  // Check resend limit
  const resendCheck = await canResendOtp(phone);
  if (!resendCheck.allowed) {
    throw new Error(resendCheck.error);
  }

  // Update resend tracking
  const existing = resendStore.get(phone);
  resendStore.set(phone, {
    count: (existing?.count ?? 0) + 1,
    lastSentAt: Date.now(),
  });

  // Clean up old entries
  for (const [key, val] of resendStore) {
    if (Date.now() - val.lastSentAt > RESEND_WINDOW_MS) {
      resendStore.delete(key);
    }
  }

  const isDev = process.env.NODE_ENV === 'development' && process.env.ENABLE_TEST_OTP === 'true';
  const code = isDev ? '111111' : generateRandomOtp();
  const entry: OtpEntry = {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    verified: false,
  };

  memoryStore.set(phone, entry);

  logger.debug('[OTP] Generated', { phone: phone.slice(-4) });
  return code;
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  // Allow test OTP only in dev/test when explicitly enabled
  const isDev = process.env.NODE_ENV === 'development' && process.env.ENABLE_TEST_OTP === 'true';
  if (isDev && code === '111111') return { valid: true };

  const entry: OtpEntry | null = memoryStore.get(phone) || null;

  if (!entry) return { valid: false, error: 'No OTP found. Please request a new OTP.' };
  if (entry.verified) return { valid: false, error: 'OTP already used.' };
  if (Date.now() > entry.expiresAt) return { valid: false, error: 'OTP expired.' };

  entry.attempts += 1;

  if (entry.attempts > MAX_ATTEMPTS) {
    memoryStore.delete(phone);
    return { valid: false, error: 'Too many failed attempts.' };
  }

  // Verification
  if (code !== entry.code) {
    return {
      valid: false,
      error: `Invalid OTP. ${MAX_ATTEMPTS - entry.attempts} attempts remaining.`,
    };
  }

  // Success
  entry.verified = true;
  return { valid: true };
}

export async function clearOtpStore(): Promise<void> {
  memoryStore.clear();
}
