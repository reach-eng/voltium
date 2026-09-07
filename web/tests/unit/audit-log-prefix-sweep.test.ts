import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RETENTION_PERIODS } from '@/lib/audit-log';

// NET-005 follow-up-5 (2026-09-08): a source-scan lock
// for the audit-log action-string prefix contract.
//
// Every `createAuditLog({ action: 'X.Y', ... })` call site
// in the codebase must use an action string whose PREFIX
// (the part before the first `.`) is either:
//   - a key in RETENTION_PERIODS (most prefixes)
//   - the special-case set `transaction` / `financial`
//     / `wallet` (which map to 2555d via the
//     `getRetentionDays` special case)
//   - the special-case `admin.login` / `admin.logout` /
//     `admin.auth` (which map to 90d via the auth row)
//
// If a future call site uses a prefix that doesn't match,
// the new `getRetentionDays` lookup falls through to the
// 90-day default — which is the same drift class this
// commit closes for the KYC, rider, and bulk action
// groups. This test fails CI on a new drift before it
// ships.

const SRC_ROOT = path.resolve(__dirname, '../../src');

// File extensions to scan for `createAuditLog` call sites.
// We scan `.ts` and `.tsx` (no .js in src).
const EXTS = new Set(['.ts', '.tsx']);

// Directories to skip (no audit-log writes here, just
// contracts and tests).
const SKIP_DIRS = new Set(['contracts', 'tests']);

/**
 * Recursively walk a directory and yield every `.ts` /
 * `.tsx` file (relative path).
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name)));
      continue;
    }
    const ext = path.extname(entry.name);
    if (EXTS.has(ext)) out.push(path.join(dir, entry.name));
  }
  return out;
}

/**
 * For a given source file, find every `action: '<value>'`
 * literal that's inside a `createAuditLog` call. The
 * pattern matches both single-quoted and double-quoted
 * string literals and avoids false positives by requiring
 * the `action:` key on the same line.
 *
 * Note: the regex is intentionally narrow — it only
 * matches static string literals (single- or double-quoted)
 * on the same line as `action:`. Template literals and
 * computed action strings are out of scope for the sweep
 * (the use-case should still use a static action string
 * for the retention table to apply).
 */
function findActionLiterals(filePath: string): string[] {
  const text = fs.readFileSync(filePath, 'utf8');
  const out: string[] = [];
  // Match `action: 'X.Y'` or `action: "X.Y"`. Skip
  // template literals (backticks) and dynamic values.
  const re = /action:\s*['"]([^'"`\n]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = m[1];
    // Only include values that look like audit-log action
    // strings (lower-kebab / lower-snake / lower-dotted
    // with a verb suffix). Skip type-definition unions
    // like 'APPROVE' | 'REJECT' (which would be caught by
    // the regex but filtered here).
    if (/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(value)) {
      out.push(value);
    }
  }
  return out;
}

// The `getRetentionDays` lookup also matches these prefixes
// via the special case at lib/audit-log.ts:20-25:
//   - `transaction` / `financial` / `wallet` → 2555d
//   - `admin.login` / `admin.logout` / `admin.auth` → 90d
// The function falls through to 90d for any other prefix
// not in the table. We treat every key in the table + the
// two special-cased prefix families as "documented".
const KNOWN_PREFIXES = new Set<string>([
  ...Object.keys(RETENTION_PERIODS),
  // `wallet` is not a key in the table (the table has
  // `transaction` and `financial`), but `getRetentionDays`
  // special-cases the `wallet` prefix to 2555d. Include
  // it so the sweep test doesn't flag `wallet.*` actions
  // as drift.
  'wallet',
  // `admin.*` is a special case in `getRetentionDays`
  // (only `admin.login` / `admin.logout` / `admin.auth`
  // are recognized), but the prefix family is documented
  // by the special case. Include it so the sweep test
  // doesn't flag `admin.*` actions as drift.
  'admin',
]);

describe('NET-005 follow-up-5: audit-log action-string prefix sweep', () => {
  // Walk every `createAuditLog` call site in `src/` and
  // assert the action's prefix is documented (in the
  // retention table or special-cased). This is the lock
  // that prevents a future drift.
  it('every createAuditLog action-string prefix is in RETENTION_PERIODS or special-cased', () => {
    const files = walk(SRC_ROOT);
    const allActions: { file: string; action: string; prefix: string }[] =
      [];
    for (const file of files) {
      for (const action of findActionLiterals(file)) {
        const prefix = action.split('.')[0];
        allActions.push({
          file: path.relative(SRC_ROOT, file),
          action,
          prefix,
        });
      }
    }

    // Build the list of drift entries (prefix not in the
    // documented set).
    const drift = allActions.filter((a) => !KNOWN_PREFIXES.has(a.prefix));

    // If we have any drift, fail with a detailed message
    // that lists the file + action for each drift entry.
    // This makes the fix trivial: a developer reading the
    // failure knows exactly which lines to update.
    if (drift.length > 0) {
      const summary = drift
        .map((d) => `  ${d.file}: '${d.action}' (prefix '${d.prefix}')`)
        .join('\n');
      throw new Error(
        `Found ${drift.length} audit-log action string(s) with an ` +
          `undocumented prefix. Add a row to RETENTION_PERIODS in ` +
          `web/src/lib/audit-log.ts for each prefix, or rename the ` +
          `action to a documented prefix.\n\n` +
          summary
      );
    }

    // Sanity: assert we found at least one action (a
    // passing sweep on an empty codebase is meaningless).
    expect(allActions.length).toBeGreaterThan(0);
  });
});
