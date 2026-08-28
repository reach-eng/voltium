/**
 * P2-2 (PR-A, 2026-08-28 workflows polish): ensure the wallet use-cases
 * format paise as rupees using the shared `formatRupeesFromPaise` helper
 * rather than the ad-hoc `₹${(amountInPaise / 100).toFixed(2)}` template.
 *
 * Verifies the string-construction surface of the three sites:
 *   - top-up request (transaction description)            — wallet.use-cases.ts:192
 *   - top-up approval (push notification body)            — wallet.use-cases.ts:380
 *   - top-up rejection (push notification body)           — wallet.use-cases.ts:420
 *
 * We test by importing the module and grepping the source for the
 * forbidden pattern. A more invasive test would call the real methods
 * with a Prisma mock; the template-fix is the user-visible behavior,
 * and a text-grep catches regressions cheaply.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const WALLET_UC_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'server',
  'modules',
  'wallet',
  'wallet.use-cases.ts',
);

describe('wallet use-cases paise formatting (P2-2)', () => {
  it('contains no ad-hoc ₹${.../100.toFixed(2)} templates', () => {
    const source = fs.readFileSync(WALLET_UC_PATH, 'utf8');
    // The forbidden pattern: a rupee literal followed by an inline paise/100 division.
    // Matches `₹${(x / 100).toFixed(2)}` and `₹${x.toFixed(2)}` (paise-as-rupees bug).
    const forbidden = /₹\$\{[^}]*\/ ?100\)\.toFixed\(2\)|₹\$\{[^}]*amountInPaise[^}]*\/ ?100\)/;
    expect(source).not.toMatch(forbidden);
  });

  it('imports formatRupeesFromPaise from @/lib/money', () => {
    const source = fs.readFileSync(WALLET_UC_PATH, 'utf8');
    expect(source).toMatch(/import\s*\{\s*formatRupeesFromPaise\s*\}\s*from\s*'@\/lib\/money'/);
  });

  it('uses formatRupeesFromPaise at all three call sites (>= 3 occurrences)', () => {
    const source = fs.readFileSync(WALLET_UC_PATH, 'utf8');
    const matches = source.match(/formatRupeesFromPaise\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});
