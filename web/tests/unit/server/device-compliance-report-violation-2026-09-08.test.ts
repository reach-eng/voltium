import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P1-3 (device-tracking section audit, 2026-09-08) — server dedupe
 * + resolve-on-grant.
 *
 * The client posts on every failed integrity check (with a 6/session
 * backoff), so a rider who denies location for a month accumulates
 * hundreds of ACTIVE rows; the counter (which gates the P1-2 alert)
 * only grows. Two fixes:
 *
 *   1. `reportViolation` adds a `findFirst({ status: 'ACTIVE' })` guard
 *      that returns the existing row without creating a new one.
 *   2. A new `resolveViolationOnGrant(riderDbId, permissionId)` use
 *      case closes the open row + decrements the counter, called
 *      from the consent POST route when the rider re-grants.
 *
 * The counter decrement is clamped at 0 — Prisma's `decrement` op
 * is unconditional, so we read first and clamp.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const USE_CASES = join(REPO_ROOT, 'src', 'server', 'modules', 'device-compliance', 'device-compliance.use-cases.ts');
const CONSENT_ROUTE = join(REPO_ROOT, 'src', 'app', 'api', 'rider', 'consent', 'route.ts');

function stripAllDocComments(text: string): string {
  return text.replace(/\/\*\*[\s\S]*?\*\//g, '');
}

describe('P1-3: reportViolation dedupes ACTIVE rows', () => {
  it('the use case looks for an existing ACTIVE row before creating one', () => {
    const text = stripAllDocComments(readFileSync(USE_CASES, 'utf8'));
    expect(text).toMatch(/db\.deviceViolation\.findFirst/);
    expect(text).toMatch(/status:\s*'ACTIVE'/);
    expect(text).toMatch(/if\s*\(\s*existing\s*\)\s*\{[\s\S]*return\s+existing/);
  });

  it('resolveViolationOnGrant closes open ACTIVE rows + decrements the counter', () => {
    const text = readFileSync(USE_CASES, 'utf8');
    expect(text).toMatch(/async\s+resolveViolationOnGrant/);
    expect(text).toMatch(/status:\s*'RESOLVED'/);
    // The decrement must clamp at 0 (Prisma's `decrement` is
    // unconditional).
    expect(text).toMatch(/Math\.max\(\s*0\s*,/);
  });
});

describe('P1-3: the consent POST route wires resolve-on-grant', () => {
  it('imports the deviceComplianceUseCases', () => {
    const text = readFileSync(CONSENT_ROUTE, 'utf8');
    expect(text).toMatch(/import\s*\{[^}]*deviceComplianceUseCases[^}]*\}\s*from\s*['"]@\/server\/modules\/device-compliance\/device-compliance\.use-cases['"]/);
  });

  it('calls resolveViolationOnGrant when granted is true', () => {
    const text = readFileSync(CONSENT_ROUTE, 'utf8');
    // The call must be inside an `if (granted)` guard so denial
    // does not close a violation.
    expect(text).toMatch(/if\s*\(\s*granted\s*\)/);
    expect(text).toMatch(/resolveViolationOnGrant\s*\(\s*auth\.riderDbId\s*,\s*consentType\s*\)/);
  });

  it('does not call resolveViolationOnGrant when granted is false', () => {
    // Reading the file: the call lives inside `if (granted) { ... }`,
    // so a denial POST skips it. The static check below verifies
    // there's no path that calls the use case outside that guard.
    const text = readFileSync(CONSENT_ROUTE, 'utf8');
    const grantGuardIndex = text.indexOf('if (granted)');
    const callIndex = text.indexOf('resolveViolationOnGrant');
    expect(grantGuardIndex).toBeGreaterThan(-1);
    expect(callIndex).toBeGreaterThan(grantGuardIndex);
  });
});
