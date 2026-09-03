/**
 * OTP Store — PostgreSQL-backed for laptop production, with in-memory fallback for development/tests.
 *
 * Stores only salted hashes of OTP codes. Production OTPs survive Node restarts and are rate-limited
 * by resend count/cooldown in the local PostgreSQL database.
 */

import crypto from 'crypto';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60s cooldown to reduce SMS gateway costs
const RESEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESENDS = 3; // max 3 requests per 10-minute window

const MAX_STORE_SIZE = 1000;

const globalForOtp = globalThis as unknown as {
  _voltiumMemoryStore?: Map<string, OtpEntry>;
  _voltiumResendStore?: Map<string, { count: number; lastSentAt: number }>;
};

const memoryStore = (globalForOtp._voltiumMemoryStore ??= new Map<string, OtpEntry>());
const resendStore = (globalForOtp._voltiumResendStore ??= new Map<string, { count: number; lastSentAt: number }>());

function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= MAX_STORE_SIZE) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, value);
}

function shouldUseDatabaseStore(): boolean {
  // PR-112 (SEC PR-5): gate the Postgres OTP store on the canonical APP_ENV
  // first. APP_ENV=staging is treated as production-grade (real Postgres,
  // cross-restart persistence) so a misconfigured prod with
  // APP_ENV=staging + NODE_ENV=production doesn't fall back to in-memory.
  return (
    process.env.APP_ENV === 'production' ||
    process.env.APP_ENV === 'staging' ||
    process.env.NODE_ENV === 'production' ||
    process.env.OTP_STORE_PROVIDER === 'postgres'
  );
}

function hashOtp(code: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

/** P1: constant-time hex comparison for both OTP store paths. */
function timingSafeEqualHex(code: string, salt: string, expectedHash: string): boolean {
  const actual = hashOtp(code, salt);
  const aBuf = Buffer.from(actual, 'utf8');
  const bBuf = Buffer.from(expectedHash, 'utf8');
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * P1: the `111111` dev shortcut fires ONLY in non-production APP_ENV.
 * The old gate (`APP_ENV=development || NODE_ENV=development ||
 * ENABLE_TEST_OTP=true`) allowed APP_ENV=staging + ENABLE_TEST_OTP=true to
 * leak the shortcut despite the comment claiming "staging always uses real
 * OTP". APP_ENV is authoritative: production/staging never take the shortcut,
 * regardless of flags. Local dev/E2E (APP_ENV unset → development) unaffected.
 */
function isDevOtpAllowed(): boolean {
  const appEnv = process.env.APP_ENV;
  if (appEnv === 'production' || appEnv === 'staging') return false;
  return (
    appEnv === undefined ||
    appEnv === 'development' ||
    appEnv === 'test' ||
    process.env.NODE_ENV === 'development' ||
    process.env.ENABLE_TEST_OTP === 'true'
  ) && process.env.ENABLE_TEST_OTP !== 'false';
}

export function generateRandomOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function canResendOtp(phone: string): Promise<{ allowed: boolean; error?: string }> {
  // P1: cooldown + window caps apply in EVERY env (the old early
  // `allowed:true` for non-prod disabled abuse protection locally and let
  // dev phones spam the SMS gateway path unchecked).
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

  // P1: a record outside the window no longer counts (generateOtp resets it).
  if (Date.now() - record.lastSentAt > RESEND_WINDOW_MS) return { allowed: true };

  if (Date.now() - record.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - record.lastSentAt)) / 1000);
    return { allowed: false, error: `Please wait ${waitSeconds}s before requesting a new OTP.` };
  }

  if (record.count >= MAX_RESENDS) {
    return { allowed: false, error: 'Too many OTP requests. Please try again later.' };
  }

  return { allowed: true };
}

export async function generateOtp(rawPhone: string): Promise<string> {
  const phone = rawPhone.replace(/\D/g, '').slice(-10) || rawPhone;
  const resendCheck = await canResendOtp(phone);
  if (!resendCheck.allowed) throw new Error(resendCheck.error);

  // PR-112 (SEC PR-5): the dev OTP shortcut (`'111111'`) only fires when
  // isDevOtpAllowed() (non-prod APP_ENV). APP_ENV=staging/production always
  // use a real random OTP even if ENABLE_TEST_OTP is on.
  const code = isDevOtpAllowed() ? '111111' : generateRandomOtp();

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
  // P1: reset the window counter when outside the window (the old code only
  // swept stale entries periodically, capping dev phones at 3 lifetime
  // resends until restart).
  const outsideWindow = !existing || Date.now() - existing.lastSentAt > RESEND_WINDOW_MS;
  setBoundedMap(resendStore, phone, { count: outsideWindow ? 1 : existing.count + 1, lastSentAt: Date.now() });
  for (const [key, val] of resendStore) {
    if (Date.now() - val.lastSentAt > RESEND_WINDOW_MS) resendStore.delete(key);
  }

  setBoundedMap(memoryStore, phone, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    verified: false,
  });
  logger.debug('[OTP] Generated in memory store', { phone: phone.slice(-4) });
  return code;
}

export async function verifyOtp(
  rawPhone: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const phone = rawPhone.replace(/\D/g, '').slice(-10) || rawPhone;
  // PR-112 (SEC PR-5): mirror the dev-OTP gate from generateOtp. APP_ENV wins.
  const isDev = isDevOtpAllowed();

  if (shouldUseDatabaseStore()) {
    const entry = await db.otpCode.findUnique({ where: { phone } }).catch(() => null);
    if (!entry) return { valid: false, error: 'No OTP found. Please request a new OTP.' };
    if (entry.verified) return { valid: false, error: 'OTP already used.' };
    if (Date.now() > entry.expiresAt.getTime()) return { valid: false, error: 'OTP expired.' };
    if (entry.attempts >= MAX_ATTEMPTS) {
      await db.otpCode.delete({ where: { phone } }).catch(() => {});
      return { valid: false, error: 'Too many failed attempts.' };
    }
    // PR-111 (SEC PR-3): dev OTP `'111111'` check is the LAST gate — only after
    // an entry exists AND it is unverified AND it is not expired AND it has not
    // exceeded the attempt cap.
    if (isDev && code === '111111') {
      const updateResult = db.otpCode.update({
        where: { phone },
        data: { verified: true, attempts: { increment: 1 } },
      });
      if (updateResult && typeof updateResult.catch === 'function') {
        await updateResult.catch(() => {});
      }
      return { valid: true };
    }

    const valid = timingSafeEqualHex(code, entry.salt, entry.codeHash);
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
  if (entry.verified) return { valid: false, error: 'OTP already used.' };
  if (Date.now() > entry.expiresAt) return { valid: false, error: 'OTP expired.' };

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    memoryStore.delete(phone);
    return { valid: false, error: 'Too many failed attempts.' };
  }
  // PR-111 (SEC PR-3): dev OTP `'111111'` check is the LAST gate
  if (isDev && code === '111111') {
    entry.verified = true;
    return { valid: true };
  }
  const aBuf = Buffer.from(code.padEnd(6, ' '), 'utf8');
  const bBuf = Buffer.from(entry.code.padEnd(6, ' '), 'utf8');
  const validCode = aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
  if (!validCode)
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
