/**
 * PR-8 (2026-08-06 fix-plan, 7th audit P0): payment-gateway credentials must
 * be encrypted at rest (AES-256-GCM via lib/pii-crypto) with an idempotent
 * encrypt — the admin edit dialog round-trips the decrypted secret, so an
 * already-encrypted value must never be double-encrypted — and legacy
 * plaintext rows must decrypt to themselves.
 */

import { describe, it, expect } from 'vitest';
import { encryptCredential, decryptCredential } from '@/lib/credentials';

// The dev fallback key path in pii-crypto requires either the env var or
// ALLOW_DEV_PII_KEY=true to avoid a throw at encrypt time.
process.env.ALLOW_DEV_PII_KEY = 'true';

describe('encryptCredential / decryptCredential — PR-8 credential at-rest encryption', () => {
  it('stores a credential then reads it back to the original value', () => {
    const secret = 'rzp_live_8xK0vYw2Jq4L';
    const cipher = encryptCredential(secret);

    // Ciphertext is not the plaintext…
    expect(cipher).not.toBe(secret);
    // …carries the versioned envelope…
    expect(cipher).toMatch(/^v\d+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
    // …and decrypts back to the original.
    expect(decryptCredential(cipher)).toBe(secret);
  });

  it('never double-encrypts an already-encrypted value (edit round-trip)', () => {
    const once = encryptCredential('whsec_super_secret');
    const twice = encryptCredential(once as string);
    expect(twice).toBe(once);
    expect(decryptCredential(twice)).toBe('whsec_super_secret');
  });

  it('passes legacy plaintext rows through unchanged on decrypt', () => {
    // Pre-encryption rows store the raw secret — decrypt must not crash or
    // corrupt them; the next write migrates them to ciphertext.
    expect(decryptCredential('rzp_test_legacy_plaintext')).toBe('rzp_test_legacy_plaintext');
  });

  it('treats null / undefined / empty as no-op', () => {
    expect(encryptCredential(null)).toBeNull();
    expect(encryptCredential(undefined)).toBeUndefined();
    expect(encryptCredential('')).toBe('');
    expect(decryptCredential(null)).toBeNull();
    expect(decryptCredential('')).toBe('');
  });

  it('encrypts webhook secrets the same way (second secret column)', () => {
    const cipher = encryptCredential('whsec_1234567890abcdef');
    expect(cipher).not.toBe('whsec_1234567890abcdef');
    expect(decryptCredential(cipher)).toBe('whsec_1234567890abcdef');
  });
});
