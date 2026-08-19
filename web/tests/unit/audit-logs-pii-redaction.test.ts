/**
 * PR-153 — Regression guard for the audit-logs PII redaction fix.
 *
 * The audit-logs GET route returns AuditLog rows whose `details`
 * column is a JSON string that can contain phone numbers, Aadhaar,
 * PAN, account numbers, emails, etc. — all PII. Before PR-153, the
 * route passed `details` through verbatim; admins could see other
 * riders' PII.
 *
 * The fix: route now does `JSON.parse(details)` then passes the
 * result through `redactPii` from `@/lib/pii-redact`. redactPii
 * matches the SENSITIVE_KEYS set (aadhaar, pan, phone, email,
 * password, secret, token, etc.) and replaces those values with
 * `[REDACTED]`. It also matches values that look like JWTs or long
 * hex strings.
 *
 * This test asserts:
 *   - The route imports redactPii
 *   - The response.map loop calls redactPii
 *   - The JSON.parse happens before redactPii (so the walker can
 *     inspect structured keys)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROUTE = resolve(
  __dirname,
  '../../src/app/api/admin/audit-logs/route.ts'
);

function src(): string {
  return readFileSync(ROUTE, 'utf-8');
}

describe('PR-153: audit-logs PII redaction', () => {
  it('route file exists', () => {
    expect(existsSync(ROUTE)).toBe(true);
  });

  it('imports redactPii from @/lib/pii-redact', () => {
    const s = src();
    expect(s).toMatch(/import\s*\{[^}]*redactPii[^}]*\}\s*from\s*['"]@\/lib\/pii-redact['"]/);
  });

  it('parses details as JSON before redacting (so the walker sees keys)', () => {
    const s = src();
    // P2-6 (2026-08-05 ops audit): parsing moved into the parseDetails()
    // helper so a malformed JSON row can't 500 the whole endpoint — the
    // parse-before-redact guarantee still holds.
    expect(s).toMatch(/function parseDetails/);
    expect(s).toMatch(/JSON\.parse\(details\)/);
  });

  it('calls redactPii on the parsed details', () => {
    const s = src();
    expect(s).toMatch(/redactPii\(parseDetails\(log\.details\)\)/);
  });

  it('returns redactedLogs (not the raw result.logs)', () => {
    const s = src();
    // The route builds `redactedLogs` and returns it. It must NOT
    // return `result.logs` directly.
    expect(s).toMatch(/const redactedLogs\s*=\s*result\.logs\.map/);
    expect(s).toMatch(/return success\(redactedLogs/);
    expect(s).not.toMatch(/return success\(result\.logs/);
  });

  it('handles null/empty details gracefully (no JSON.parse on null)', () => {
    const s = src();
    // parseDetails short-circuits falsy values; the map passes log.details
    // through it unconditionally.
    expect(s).toMatch(/if \(!details\) return null/);
    expect(s).toMatch(/details: redactPii\(parseDetails\(log\.details\)\)/);
  });
});
