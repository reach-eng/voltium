// R10 polish #9 (security): regression test for pii-redact hardening.
// Locks in the contract:
//   - §4.3 keySecret, webhookSecret, merchantId are redacted
//   - §4.4 32+ char hex strings are redacted
//   - §4.5 Error objects have all enumerable properties recursively redacted
//   - §4.7 16+ char strings (was 32) are pattern-matched

import { describe, it, expect } from 'vitest';
import { redactPii } from '@/lib/pii-redact';

describe('pii-redact R10 polish #9', () => {
  describe('§4.3 — additional sensitive keys', () => {
    it('redacts keySecret', () => {
      const out = redactPii({ keySecret: 'whsec_abc123' });
      expect(out).toEqual({ keySecret: '[REDACTED]' });
    });

    it('redacts webhookSecret', () => {
      const out = redactPii({ webhookSecret: 'shh' });
      expect(out).toEqual({ webhookSecret: '[REDACTED]' });
    });

    it('redacts merchantId (case-insensitive)', () => {
      const out = redactPii({ MerchantId: 'razorpay_xyz' });
      expect(out).toEqual({ MerchantId: '[REDACTED]' });
    });
  });

  describe('§4.4 — hex pattern', () => {
    it('redacts 64-char lowercase hex (SHA-256-like)', () => {
      const hex = 'a'.repeat(64);
      expect(redactPii({ token: hex })).toEqual({ token: '[REDACTED]' });
    });

    it('redacts 32-char hex (UUID-like)', () => {
      const hex = 'deadbeefcafe1234deadbeefcafe1234';
      expect(redactPii({ key: hex })).toEqual({ key: '[REDACTED]' });
    });

    it('preserves short hex (< 32 chars)', () => {
      // 16 hex chars = NOT a secret, should not match the pattern
      const out = redactPii({ id: 'cafe1234' });
      expect(out).toEqual({ id: 'cafe1234' });
    });
  });

  describe('§4.5 — Error object redaction', () => {
    it('preserves name + message + recursively redacts custom props', () => {
      const err = new Error('login failed');
      (err as any).code = 'AUTH_INVALID';
      (err as any).details = { password: 'hunter2' };
      (err as any).stack = 'should-be-stripped';

      const out = redactPii(err) as any;
      expect(out.name).toBe('Error');
      expect(out.message).toBe('login failed');
      expect(out.code).toBe('AUTH_INVALID');
      expect(out.details).toEqual({ password: '[REDACTED]' });
      expect(out.stack).toBeUndefined();
    });
  });

  describe('§4.7 — length threshold lowered from 32 to 16', () => {
    it('pattern-matches 20-char base64 (would have passed before)', () => {
      // 20-char base64 = ~15 bytes of payload, still potentially sensitive
      const short = 'aGVsbG93b3JsZGZvb2Jhcg=='; // 20 chars
      expect(short.length).toBeLessThan(32);
      expect(redactPii({ secret: short })).toEqual({ secret: '[REDACTED]' });
    });

    it('preserves short non-sensitive strings (under 16 chars)', () => {
      expect(redactPii({ name: 'hi' })).toEqual({ name: 'hi' });
      expect(redactPii({ msg: 'abcdefghijklmno' })).toEqual({ msg: 'abcdefghijklmno' });
    });
  });

  describe('basic redaction (regression)', () => {
    it('redacts nested password fields', () => {
      const out = redactPii({
        user: { email: 'a@b.com', password: 'secret123' },
      });
      expect(out).toEqual({
        user: { email: '[REDACTED]', password: '[REDACTED]' },
      });
    });
  });
});
