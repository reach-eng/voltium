/**
 * PR-99 (SEC-N-0) — security-event loggers wiring
 *
 * The original 4 unwired loggers in src/lib/security-events.ts:
 *   - logPermissionDenied
 *   - logKycDocumentView
 *   - logAccountSuspension
 *   - logReconciliationMismatch
 *
 * Each is now called from at least one production code path. This
 * test asserts the wiring is in place by checking that each logger
 * function is imported + called from its expected location.
 *
 * What this test asserts:
 *   1. Each unwired logger is imported in its expected file
 *   2. Each unwired logger is called in its expected file
 *   3. The new adminForbiddenWithLog() helper exists in rbac.ts
 *   4. The helper has the expected signature
 *
 * Pure file inspection — no DB or runtime required.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SRC = (rel: string) => resolve(__dirname, '../../src', rel);

const WIRING = [
  {
    name: 'logPermissionDenied',
    file: 'lib/rbac.ts',
    importedIn: 'lib/rbac.ts',
    calledIn: 'lib/rbac.ts',
    helperFn: 'adminForbiddenWithLog',
  },
  {
    name: 'logKycDocumentView',
    file: 'lib/security-events.ts',
    importedIn: 'server/modules/kyc/kyc.repository.ts',
    calledIn: 'server/modules/kyc/kyc.repository.ts',
  },
  {
    name: 'logAccountSuspension',
    file: 'lib/security-events.ts',
    importedIn: 'server/modules/riders/admin-riders.use-cases.ts',
    calledIn: 'server/modules/riders/admin-riders.use-cases.ts',
  },
  {
    name: 'logReconciliationMismatch',
    file: 'lib/security-events.ts',
    importedIn: 'server/workers/jobs/wallet-reconciliation.job.ts',
    calledIn: 'server/workers/jobs/wallet-reconciliation.job.ts',
  },
];

describe('PR-99: security-event loggers are wired', () => {
  WIRING.forEach((w) => {
    it(`${w.name} is imported in ${w.importedIn}`, () => {
      const f = SRC(w.importedIn);
      expect(existsSync(f), `expected file ${w.importedIn}`).toBe(true);
      const content = readFileSync(f, 'utf-8');
      expect(content, `${w.name} should be imported`).toMatch(
        new RegExp(`import\\s*\\{[^}]*\\b${w.name}\\b[^}]*\\}\\s*from`)
      );
    });

    it(`${w.name} is called in ${w.calledIn}`, () => {
      const f = SRC(w.calledIn);
      const content = readFileSync(f, 'utf-8');
      // Match the bare function call (not the declaration or import)
      // Allow whitespace + optional `void` or `await` prefix
      const pattern = new RegExp(`(?:void|await)?\\s*${w.name}\\s*\\(`);
      expect(content, `${w.name} should be called`).toMatch(pattern);
    });
  });

  it('adminForbiddenWithLog helper exists in lib/rbac.ts with the expected signature', () => {
    const f = SRC('lib/rbac.ts');
    const content = readFileSync(f, 'utf-8');
    expect(content).toContain('export function adminForbiddenWithLog');
    // Should accept a context object with session, permission, route
    expect(content).toMatch(/adminForbiddenWithLog\s*\(\s*context\s*:\s*\{/);
    expect(content).toContain('permission:');
    expect(content).toContain('route:');
    // Should fire the logPermissionDenied call
    expect(content).toContain('logPermissionDenied');
  });

  it('kyc/route.ts uses adminForbiddenWithLog for permission-denied path', () => {
    const f = SRC('app/api/admin/kyc/route.ts');
    const content = readFileSync(f, 'utf-8');
    expect(content).toContain('adminForbiddenWithLog');
  });
});
