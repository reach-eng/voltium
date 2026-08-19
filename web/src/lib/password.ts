/**
 * Password hashing using Argon2id (primary) with PBKDF2-SHA256 fallback.
 *
 * New hashes use Argon2id (OWASP first recommendation).
 * Existing PBKDF2 hashes are verified and re-hashed on next login.
 *
 * Format (Argon2id): `$argon2id$v=19$m=65536,t=3,p=4$<base64salt>$<base64hash>`
 * Format (PBKDF2):   `$pbkdf2$600000$<base64salt>$<base64hash>`
 */

import * as argon2 from 'argon2';
import { logger } from './logger';

const ARGON2_OPTIONS: argon2.Options & { raw?: boolean } = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * Hash a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a hashed password.
 * Supports both Argon2id and legacy PBKDF2 formats.
 *
 * Returns an object with `valid` (boolean) and `needsRehash` (boolean).
 * Callers should re-save the password when `needsRehash` is true.
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!password || !hashedPassword) {
    return { valid: false, needsRehash: false };
  }

  // ── Argon2id ──────────────────────────────────────────────────────
  if (hashedPassword.startsWith('$argon2id$')) {
    try {
      const valid = await argon2.verify(hashedPassword, password);
      return {
        valid,
        needsRehash: valid && (await argon2.needsRehash(hashedPassword, ARGON2_OPTIONS)),
      };
    } catch (err) {
      // P2-16: a corrupted/malformed argon2 hash throws instead of returning
      // false. Swallowing it made corrupt rows look like "wrong password" —
      // log it so operators can spot the data problem (and tell it apart from
      // a genuine auth failure). Still reports invalid so we never leak a
      // hash-format oracle to callers.
      logger.error('[Password] argon2.verify failed (corrupted hash?)', {
        error: err instanceof Error ? err.message : String(err),
        format: hashedPassword.split('$')[1] ?? 'unknown',
      });
      return { valid: false, needsRehash: false };
    }
  }

  // ── Legacy PBKDF2 ─────────────────────────────────────────────────
  if (hashedPassword.startsWith('$pbkdf2$')) {
    const valid = await verifyPbkdf2(password, hashedPassword);
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}

/**
 * Legacy PBKDF2-SHA256 verification (600k iterations, 16-byte salt).
 * Used only during the migration window — all new hashes use Argon2id.
 *
 * SECURITY (R10 polish #3):
 *   §2.3 — NaN guard: `parseInt` can return NaN for malformed input; we
 *          treat any non-finite iteration count as invalid.
 *   §2.4 — try/catch around the WebCrypto deriveBits call so a runtime
 *          error (e.g. unsupported algorithm) doesn't bubble up as 500.
 *   §2.5 — MAX_ITERATIONS lowered from 10M to 1M. 10M allowed an attacker
 *          who controlled the iteration count in a forged hash header to
 *          spin the server for ~30s per verify. 1M is still 5x the
 *          legitimate 200k default; anything higher is rejected.
 */
async function verifyPbkdf2(password: string, hashedPassword: string): Promise<boolean> {
  const MAX_ITERATIONS = 1_000_000;

  const parts = hashedPassword.split('$');
  if (parts.length !== 5) return false;

  const rawIterations = parseInt(parts[2], 10);
  if (!Number.isFinite(rawIterations) || rawIterations < 1) return false;
  const iterations = Math.min(rawIterations, MAX_ITERATIONS);
  const salt = fromBase64(parts[3]);
  const expectedHash = fromBase64(parts[4]);

  const encoder = new TextEncoder();
  try {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const hashBuf = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
      keyMaterial,
      expectedHash.length * 8
    );

    // Constant-time comparison
    const computed = new Uint8Array(hashBuf);
    if (computed.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed[i] ^ expectedHash[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
