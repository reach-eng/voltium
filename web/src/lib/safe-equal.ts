/**
 * 9.5+ Hardening §6 (T-9P0-3): constant-time string comparison for
 * shared secrets.
 *
 * Plain `===` on long secrets leaks a timing channel: an attacker can
 * measure response-time deltas to guess the secret one character at a
 * time. `timingSafeEqual` from `node:crypto` runs in constant time
 * regardless of where the strings diverge.
 *
 * The two inputs MUST be the same length for the comparison to run —
 * if the attacker can vary the length, the length alone tells them
 * something. We return `false` for length mismatch in constant time
 * (length comparison on a fixed-width integer is not a secret).
 */
import { timingSafeEqual } from 'node:crypto';

export function safeEqualSecret(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
