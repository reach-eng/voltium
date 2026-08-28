/**
 * P2-6 (PR-B, 2026-08-28 workflows polish): the idempotency module
 * previously used a `globalThis.$_idempotencyCleanup` flag to
 * deduplicate the cleanup `setInterval` across HMR reloads. The
 * flag was unusual (flagged in §3 of the workflows audit) and is
 * no longer needed — the module is a singleton under both Next.js
 * and tsx, and a module-scoped `cleanupIntervalRegistered` flag
 * achieves the same intent.
 *
 * The test greps the source for the forbidden pattern. A runtime
 * test of the cleanup interval is impractical (it fires every
 * 10 min) and the user-visible behavior is unchanged.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const IDEMPOTENCY_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'lib',
  'idempotency.ts',
);

describe('idempotency module cleanup flag (P2-6)', () => {
  it('contains no globalThis.$_idempotencyCleanup references', () => {
    const source = fs.readFileSync(IDEMPOTENCY_PATH, 'utf8');
    expect(source).not.toMatch(/globalThis.*\$_idempotencyCleanup/);
    expect(source).not.toMatch(/globalThis\s+as\s+any.*\$_idempotencyCleanup/);
  });

  it('uses a module-scoped cleanup-interval flag', () => {
    const source = fs.readFileSync(IDEMPOTENCY_PATH, 'utf8');
    expect(source).toMatch(/cleanupIntervalRegistered/);
  });

  it('still registers the cleanup interval', () => {
    const source = fs.readFileSync(IDEMPOTENCY_PATH, 'utf8');
    // The 10-min cadence is preserved verbatim from the previous code.
    expect(source).toMatch(/10\s*\*\s*60\s*\*\s*1000/);
    expect(source).toMatch(/setInterval\(/);
  });
});
