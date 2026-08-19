/**
 * Credential at-rest encryption helper.
 *
 * PR-8 (2026-08-06 fix-plan, 7th audit P0): payment-gateway `keySecret` and
 * `webhookSecret` were stored in plaintext in the `payment_gateways` table.
 * This module wraps `lib/pii-crypto.ts` (AES-256-GCM, key-versioned) so the
 * routes encrypt on write and decrypt on read.
 *
 * Two properties matter beyond a thin wrapper:
 *
 *  1. **Idempotent encrypt** — the admin edit dialog round-trips the decrypted
 *     secret back to the server on every save. `encryptCredential` returns the
 *     value untouched if it already carries the `v<version>:iv:authTag:hex`
 *     envelope, so an already-encrypted value can never be double-encrypted.
 *
 *  2. **Legacy passthrough on decrypt** — rows written before this change are
 *     plaintext. `decryptPii` already returns unrecognized values as-is (with a
 *     warning) instead of failing, so pre-existing gateways keep working until
 *     the next write migrates them to ciphertext.
 */

import { encryptPii, decryptPii } from '@/lib/pii-crypto';

/** Matches the ciphertext envelope produced by encryptPii: v1:iv:authTag:hex. */
const ENCRYPTED_ENVELOPE_RE = /^v\d+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

export function encryptCredential(
  value: string | null | undefined
): string | null | undefined {
  if (value === null || value === undefined || value === '') return value;
  if (ENCRYPTED_ENVELOPE_RE.test(value)) return value; // already encrypted — never double-encrypt
  return encryptPii(value);
}

export function decryptCredential(
  value: string | null | undefined
): string | null | undefined {
  if (value === null || value === undefined || value === '') return value;
  // decryptPii passes unrecognized (legacy plaintext) values through untouched.
  return decryptPii(value);
}
