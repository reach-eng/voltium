import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * P0-1 (system-settings section audit, 2026-09-08) — regression gate.
 *
 * Every `isEditable: true` row in the SYSTEM_SETTINGS seed block must
 * have at least one runtime reader in `web/src/`. "Reader" here means
 * the key string appears somewhere outside:
 *   - the SYSTEM_SETTINGS seed block itself (which only defines the
 *     row — it does not read it),
 *   - the API route's header doc comment (which lists the keys for
 *     developer reference — it does not read them),
 *   - this contract test.
 *
 * A row with no reader is a dead knob — the operator's UI Save button
 * persists to a row the runtime ignores. The 10 dead rows in the audit
 * (8 BACKUP_* + 2 APP_URL) are now frozen with `isEditable: false`;
 * this test guarantees that nobody re-enables one of them without
 * wiring a reader.
 *
 * Frozen rows (isEditable: false) are *expected* to have no reader —
 * that's the point. Only editable rows are asserted.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const SRC_DIR = join(REPO_ROOT, 'src');
const SEED_FILE = join(REPO_ROOT, 'prisma', 'seed.ts');
const ROUTE_FILE = join(REPO_ROOT, 'src', 'app', 'api', 'admin', 'system-settings', 'route.ts');

interface SeededRow {
  key: string;
  isEditable: boolean;
}

/** Pull the SYSTEM_SETTINGS array out of seed.ts. The block sits between
 *  `// ==================== SYSTEM SETTINGS ====================` and the
 *  next `==========` banner. Each row is `{ key, ..., isEditable?: boolean }`. */
function parseSystemSettingsSeed(): SeededRow[] {
  const text = readFileSync(SEED_FILE, 'utf8');
  const start = text.indexOf('// ==================== SYSTEM SETTINGS ====================');
  if (start < 0) {
    throw new Error('SYSTEM_SETTINGS block not found in prisma/seed.ts');
  }
  // Find the next banner; the array ends just before it.
  const after = text.slice(start);
  const end = after.indexOf('// ====================');
  const block = end > 0 ? after.slice(0, end) : after;
  const rows: SeededRow[] = [];
  // Each row object starts with `{` and contains `key: '...'`.
  // Capture key and the isEditable flag (default true when omitted —
  // matches the schema's `isEditable @default(true)`).
  const rowRe = /\{\s*key:\s*'([A-Z0-9_]+)'[\s\S]*?isEditable:\s*(true|false)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(block)) !== null) {
    rows.push({ key: m[1], isEditable: m[2] === 'true' });
  }
  // Fallback: rows where isEditable is omitted default to true (schema).
  const keyOnlyRe = /\{\s*key:\s*'([A-Z0-9_]+)'[\s\S]*?\}/g;
  const seen = new Set(rows.map((r) => r.key));
  let k: RegExpExecArray | null;
  while ((k = keyOnlyRe.exec(block)) !== null) {
    if (!seen.has(k[1])) {
      rows.push({ key: k[1], isEditable: true });
    }
  }
  return rows;
}

/** Strip ALL JSDoc blocks from a TypeScript file. The route file
 *  has a single /** ... * / block listing every key for developer
 *  reference (and a second block the P0-1 PR added). Counting those
 *  as readers would mask the dead-knob regression we're guarding.
 *  Single-line `//` comments are kept — they may document runtime
 *  behavior. */
function stripAllDocComments(text: string): string {
  return text.replace(/\/\*\*[\s\S]*?\*\//g, '');
}

/** Recursive file walk under `dir`, returning paths ending in .ts/.tsx. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** True iff the key string appears as a literal (not just inside a word) in `text`. */
function keyAppears(key: string, text: string): boolean {
  // Word boundary on both sides — `BACKUP_FREQUENCY` should not match
  // inside `BACKUP_FREQUENCY_X` (which doesn't exist, but be defensive).
  const re = new RegExp(`(^|[^A-Z0-9_])${key}([^A-Z0-9_]|$)`);
  return re.test(text);
}

describe('SYSTEM_SETTINGS reader coverage (P0-1, 2026-09-08)', () => {
  const seeded = parseSystemSettingsSeed();
  const allFiles = walk(SRC_DIR);

  // Sanity: the seed must define at least the 15 documented rows.
  it('seed defines the expected SYSTEM_SETTINGS rows', () => {
    const keys = seeded.map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'APP_PUBLIC_URL',
        'API_BASE_URL',
        'LOCAL_STORAGE_ROOT',
        'BACKUP_ROOT',
        'BACKUP_SECONDARY_ROOT',
        'BACKUP_FREQUENCY',
        'BACKUP_TIME_OF_DAY',
        'BACKUP_TIMEZONE',
        'BACKUP_KEEP_DAILY',
        'BACKUP_KEEP_WEEKLY',
        'BACKUP_KEEP_MONTHLY',
        'BACKUP_KEEP_MANUAL',
        'BACKUP_MINIMUM_FREE_DISK_GB',
        'MAINTENANCE_MODE',
        'MAINTENANCE_MESSAGE',
      ])
    );
  });

  it('every editable SYSTEM_SETTINGS row has >= 1 runtime reader in src/', () => {
    const editable = seeded.filter((r) => r.isEditable);
    expect(editable.length).toBeGreaterThan(0);

    // Strip the route's JSDoc blocks — they list every key for developer
    // reference. Without this, a self-reference would mask a dead knob.
    const routeText = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));

    const dead: string[] = [];
    for (const row of editable) {
      const readerFile = allFiles.find((f) => {
        if (f === ROUTE_FILE) return false;
        if (f === SEED_FILE) return false;
        if (relative(REPO_ROOT, f).split(sep).join('/') ===
            relative(REPO_ROOT, __dirname).split(sep).join('/') + '/' + 'system-settings-reader-coverage-2026-09-08.test.ts') {
          return false;
        }
        // The DeadKnobBanner lists frozen keys in its UI copy to tell
        // operators WHERE the knob actually lives — that is not a
        // runtime reader, it is documentation.
        if (f.endsWith(join('system-settings', 'DeadKnobBanner.tsx'))) return false;
        const text = readFileSync(f, 'utf8');
        return keyAppears(row.key, text);
      });
      // The route's body is itself a reader: it accepts the PUT, validates
      // the key, and writes the value. A row mentioned only in the route's
      // doc comment is dead (we stripped the comment above); a row
      // mentioned in the route's body is single-reader-but-live.
      const inRouteBody = keyAppears(row.key, routeText);
      if (!readerFile && !inRouteBody) {
        dead.push(row.key);
      }
    }

    expect(dead, `editable rows with no reader in src/: ${dead.join(', ')}`).toEqual([]);
  });
});
