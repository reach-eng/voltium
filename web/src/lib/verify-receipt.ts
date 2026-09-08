/**
 * Verify-phone receipts (PR-PICKUP-OTP)
 *
 * `POST /api/auth/verify-phone` used to return a bare boolean, making the
 * pickup-flow emergency-contact OTP gate 100% client-side — any client
 * could claim "verified" without ever proving control of the number.
 *
 * This module issues a short-lived, HMAC-signed receipt on successful OTP
 * verification and lets `POST /api/rider/sync/pickup` validate it, so the
 * emergency-contact gate becomes server-enforceable.
 *
 * Format: `<expiry_epoch_ms>.<hmac-sha256(phone:expiry)>` — same shape as
 * the file-upload tokens (files.use-cases.ts) so the constant-time
 * comparison pattern is shared. Stateless: no DB row, no revocation list —
 * the 15-minute TTL bounds reuse, and expiry is checked on every verify.
 *
 * TTL parity: 15 minutes matches the client-side pickup-draft window
 * (AppConstants.emergencyContactVerificationWindow in the Flutter app).
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';

/** Short-lived validity window for a verify-phone receipt. */
export const VERIFY_RECEIPT_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Resolve the HMAC secret used to sign verify receipts. Dedicated secret
 * in production (protocol separation — mirror of PR-92 FILE_UPLOAD_SECRET);
 * falls back to JWT_SECRET in non-prod to keep the laptop setup friction-free.
 * lib/env.ts throws at boot if production is missing VERIFY_RECEIPT_SECRET;
 * this is the defensive runtime double-check.
 */
export function _getVerifyReceiptSecret(): string {
  if (env.VERIFY_RECEIPT_SECRET) return env.VERIFY_RECEIPT_SECRET;
  if (env.APP_ENV === 'production') {
    throw new Error('VERIFY_RECEIPT_SECRET is required in production');
  }
  return env.JWT_SECRET;
}

/** Issue a signed receipt proving `phone` was OTP-verified, valid 15 minutes. */
export function issueVerifyReceipt(phone: string, riderDbId?: string): string {
  const secret = _getVerifyReceiptSecret();
  const expiresAt = Date.now() + VERIFY_RECEIPT_TTL_MS;
  const scope = riderDbId ? `${riderDbId}:${phone}` : phone;
  const payload = `${scope}:${expiresAt}`;
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  if (riderDbId) {
    const scopeB64 = Buffer.from(scope, 'utf8').toString('base64url');
    return `${expiresAt}.${scopeB64}.${hmac}`;
  }
  return `${expiresAt}.${hmac}`;
}

/**
 * Validate a receipt against the emergency contact the pickup submission
 * carries. Fails on: malformed shape, expired window, signature mismatch
 * (tampering), or phone mismatch. Phone comparison is exact — callers
 * normalize to digits before invoking.
 *
 * When `expectedRiderDbId` is provided, the receipt must be rider-bound;
 * legacy unbound receipts are rejected. This prevents cross-account replay
 * on shared devices.
 */
export function verifyVerifyReceipt(
  receipt: string,
  expectedPhone: string,
  expectedRiderDbId?: string
): { valid: boolean; reason?: string } {
  try {
    const parts = receipt.split('.');
    if (parts.length !== 2 && parts.length !== 3) {
      return { valid: false, reason: 'Malformed receipt' };
    }
    const expiresAt = parseInt(parts[0], 10);
    if (isNaN(expiresAt)) {
      return { valid: false, reason: 'Malformed receipt' };
    }
    if (Date.now() > expiresAt) {
      return { valid: false, reason: 'Receipt expired' };
    }

    const secret = _getVerifyReceiptSecret();
    if (parts.length === 3) {
      let scope: string;
      try {
        scope = Buffer.from(parts[1], 'base64url').toString('utf8');
      } catch {
        return { valid: false, reason: 'Malformed receipt' };
      }
      const providedHmac = parts[2];
      const payload = `${scope}:${expiresAt}`;
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      if (providedHmac.length !== expected.length) {
        return { valid: false, reason: 'Invalid signature' };
      }
      if (!timingSafeEqual(Buffer.from(providedHmac, 'utf8'), Buffer.from(expected, 'utf8'))) {
        return { valid: false, reason: 'Invalid signature' };
      }
      const sep = scope.lastIndexOf(':');
      if (sep === -1) {
        // Bound receipt but scope malformed — treat as signature failure.
        return { valid: false, reason: 'Invalid signature' };
      }
      const scopePhone = scope.slice(sep + 1);
      if (scopePhone !== expectedPhone) {
        return { valid: false, reason: 'Invalid signature' };
      }
      if (expectedRiderDbId) {
        const scopeRider = scope.slice(0, sep);
        if (scopeRider !== expectedRiderDbId) {
          return { valid: false, reason: 'Receipt was issued for a different account. Please re-verify the number.' };
        }
      }
      return { valid: true };
    }

    // Legacy 2-part receipt.
    if (expectedRiderDbId) {
      return { valid: false, reason: 'Receipt is not bound to this account. Please re-verify the number.' };
    }
    const providedHmac = parts[1];
    const payload = `${expectedPhone}:${expiresAt}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (providedHmac.length !== expected.length) {
      return { valid: false, reason: 'Invalid signature' };
    }
    if (!timingSafeEqual(Buffer.from(providedHmac, 'utf8'), Buffer.from(expected, 'utf8'))) {
      return { valid: false, reason: 'Invalid signature' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid receipt' };
  }
}
