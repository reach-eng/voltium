/**
 * OTP Store — PostgreSQL-backed for laptop production, with in-memory fallback for development/tests.
 *
 * Stores only salted hashes of OTP codes. Production OTPs survive Node restarts and are rate-limited
 * by resend count/cooldown in the local PostgreSQL database.
 */

import crypto, { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isDevelopmentEnv } from '@/lib/env';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 30 * 1000;
const RESEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESENDS = 5;

const memoryStore = new Map<string, OtpEntry>();
const resendStore = new Map<string, { count: number; lastSentAt: number }>();

function shouldUseDatabaseStore(): boolean {
  return process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging' || process.env.OTP_STORE_PROVIDER === 'postgres';
}

function hashOtp(code: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

const DEV_OTP = '111111';
const DEV_OTP_BUF = Buffer.from(DEV_OTP, 'utf8');

/**
 * Constant-time comparison against the dev OTP. Even though the dev OTP
 * is a public constant, we use timingSafeEqual for code-rotation reasons
 * (ticket #49) — the real security check happens in the DB/memory paths
 * via SHA-256 hash + timingSafeEqual. Keeping this in lockstep makes
 * future "swap the dev OTP to a real value" changes safe by default.
 */
function matchesDevOtp(code: string): boolean {
  const codeBuf = Buffer.from(code, 'utf8');
  if (codeBuf.length !== DEV_OTP_BUF.length) return false;
  return timingSafeEqual(codeBuf, DEV_OTP_BUF);
}

export function generateRandomOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function canResendOtp(phone: string): Promise<{ allowed: boolean; error?: string }> {
  if (
    process.env.APP_ENV !== 'production' &&
    process.env.APP_ENV !== 'staging'
  ) {
    return { allowed: true };
  }
  if (shouldUseDatabaseStore()) {
    const now = new Date();
    const record = await db.otpCode.findUnique({ where: { phone } }).catch(() => null);
    if (!record) return { allowed: true };

    const lastSentAt = record.lastSentAt.getTime();
    if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000);
      return { allowed: false, error: `Please wait ${waitSeconds}s before requesting a new OTP.` };
    }

    const withinWindow = Date.now() - lastSentAt <= RESEND_WINDOW_MS;
    if (withinWindow && record.resendCount >= MAX_RESENDS) {
      return { allowed: false, error: 'Too many OTP requests. Please try again later.' };
    }
    return { allowed: true };
  }

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
  const resendCheck = await canResendOtp(phone);
  if (!resendCheck.allowed) throw new Error(resendCheck.error);

  const isDev = isDevelopmentEnv();
  const code = isDev ? '111111' : generateRandomOtp();

  if (shouldUseDatabaseStore()) {
    const now = new Date();
    const existing = await db.otpCode.findUnique({ where: { phone } }).catch(() => null);
    const withinWindow = existing
      ? Date.now() - existing.lastSentAt.getTime() <= RESEND_WINDOW_MS
      : false;
    const salt = crypto.randomBytes(16).toString('hex');
    await db.otpCode.upsert({
      where: { phone },
      create: {
        phone,
        codeHash: hashOtp(code, salt),
        salt,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        attempts: 0,
        verified: false,
        resendCount: 1,
        lastSentAt: now,
      },
      update: {
        codeHash: hashOtp(code, salt),
        salt,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        attempts: 0,
        verified: false,
        resendCount: withinWindow ? { increment: 1 } : 1,
        lastSentAt: now,
      },
    });
    await db.otpCode
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => {});
    logger.debug('[OTP] Generated in PostgreSQL store', { phone: phone.slice(-4) });
    return code;
  }

  const existing = resendStore.get(phone);
  resendStore.set(phone, { count: (existing?.count ?? 0) + 1, lastSentAt: Date.now() });
  for (const [key, val] of resendStore) {
    if (Date.now() - val.lastSentAt > RESEND_WINDOW_MS) resendStore.delete(key);
  }

  memoryStore.set(phone, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    verified: false,
  });
  logger.debug('[OTP] Generated in memory store', { phone: phone.slice(-4) });
  return code;
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const isDev = isDevelopmentEnv();

  if (shouldUseDatabaseStore()) {
    const entry = await db.otpCode.findUnique({ where: { phone } }).catch(() => null);
    if (!entry) return { valid: false, error: 'No OTP found. Please request a new OTP.' };
    // Dev OTP check AFTER entry lookup — requires an existing OTP entry.
    // Uses constant-time compare (matchesDevOtp) for consistency with
    // production OTP path; ticket #49.
    if (isDev && matchesDevOtp(code)) return { valid: true };
    if (entry.verified) return { valid: false, error: 'OTP already used.' };
    if (Date.now() > entry.expiresAt.getTime()) return { valid: false, error: 'OTP expired.' };
    if (entry.attempts >= MAX_ATTEMPTS) {
      await db.otpCode.delete({ where: { phone } }).catch(() => {});
      return { valid: false, error: 'Too many failed attempts.' };
    }

    // Timing-safe comparison: both are 64-char hex strings (32 bytes)
    const computedHash = hashOtp(code, entry.salt);
    const computedBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(entry.codeHash, 'hex');
    const valid = computedBuf.length === storedBuf.length && timingSafeEqual(computedBuf, storedBuf);
    if (!valid) {
      const updated = await db.otpCode.update({
        where: { phone },
        data: { attempts: { increment: 1 } },
      });
      return {
        valid: false,
        error: `Invalid OTP. ${Math.max(0, MAX_ATTEMPTS - updated.attempts)} attempts remaining.`,
      };
    }

    await db.otpCode.update({
      where: { phone },
      data: { verified: true, attempts: { increment: 1 } },
    });
    return { valid: true };
  }

  const entry = memoryStore.get(phone) || null;
  if (!entry) return { valid: false, error: 'No OTP found. Please request a new OTP.' };
  // Dev OTP check AFTER entry lookup — requires an existing OTP entry.
  // Constant-time compare for ticket #49.
  if (isDev && matchesDevOtp(code)) return { valid: true };
  if (entry.verified) return { valid: false, error: 'OTP already used.' };
  if (Date.now() > entry.expiresAt) return { valid: false, error: 'OTP expired.' };

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    memoryStore.delete(phone);
    return { valid: false, error: 'Too many failed attempts.' };
  }
  // Timing-safe comparison for memory path: hash both to fixed length
  const codeHash = crypto.createHash('sha256').update(code).digest();
  const entryCodeHash = crypto.createHash('sha256').update(entry.code).digest();
  if (!timingSafeEqual(codeHash, entryCodeHash))
    return {
      valid: false,
      error: `Invalid OTP. ${MAX_ATTEMPTS - entry.attempts} attempts remaining.`,
    };
  entry.verified = true;
  return { valid: true };
}

export async function clearOtpStore(): Promise<void> {
  memoryStore.clear();
  resendStore.clear();
  if (shouldUseDatabaseStore()) await db.otpCode.deleteMany({}).catch(() => {});
}
