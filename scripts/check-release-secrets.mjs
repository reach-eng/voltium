#!/usr/bin/env node
/**
 * 9.5+ Hardening (plan §4) — release-secret scanner.
 *
 * Walks the repository (or a passed-in release archive directory) and fails
 * the build if any forbidden secret-bearing file is present:
 *
 *   - .env / .env.local / .env.production / .env.staging / .env.*.local
 *   - key.properties
 *   - *.jks / *.keystore / *.p12 / *.pfx / *.pem / *.key
 *
 * Path allow-list (kept short on purpose):
 *   - flutter/assets/certs/voltium-ca.pem   — the production TLS trust
 *     anchor that ships in the app bundle. The scanner accepts it; the
 *     CA rotation runbook (plan §8.7) governs its lifecycle.
 *
 * Usage:
 *   node scripts/check-release-secrets.mjs                # scan repo root
 *   node scripts/check-release-secrets.mjs path/to/zip    # scan an extracted archive
 *
 * Exit codes:
 *   0  no forbidden files
 *   1  one or more forbidden files found
 *   2  bad arguments
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] ?? process.cwd());

const FORBIDDEN_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.staging',
  '.env.staging.local',
  'key.properties',
]);

const FORBIDDEN_EXTENSIONS = /\.(jks|keystore|p12|pfx|pem|key)$/i;

const ALLOWED_NAMES = new Set([
  '.env.example',
  '.env.local.example',
  '.env.staging.example',
  '.env.production.example',
]);

// Explicit allow-list for files the release pipeline intentionally produces.
// Keep this list SHORT — every entry should be reviewed per release.
const PATH_ALLOWLIST = new Set([
  // The production TLS trust anchor (plan §8). Lifecycle owned by the
  // CA-rotation runbook in `docs/RUNBOOK_TLS_ROTATION.md` (when written).
  'flutter/assets/certs/voltium-ca.pem',
]);

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'build',
  '.dart_tool',
  'dist',
  'coverage',
  'out',
  '.idea',
  '.vscode',
  // Generated test/build artifacts we never want to walk.
  'pino-pretty',
  '.pnpm-store',
]);

const failures = [];

function isForbiddenPath(rel) {
  if (ALLOWED_NAMES.has(rel.split(/[\\/]/).pop() ?? '')) return false;
  if (PATH_ALLOWLIST.has(rel.replaceAll('\\', '/'))) return false;
  return true;
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable (permission, broken symlink) — skip
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      // Follow symlinks only if they resolve to a directory.
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
    }
    const rel = relative(ROOT, full).replaceAll('\\', '/');
    if (!isForbiddenPath(rel)) continue;
    if (FORBIDDEN_NAMES.has(entry.name) || FORBIDDEN_EXTENSIONS.test(entry.name)) {
      failures.push(rel);
    }
  }
}

if (!existsSync(ROOT)) {
  console.error(`Release-secret gate: path does not exist: ${ROOT}`);
  process.exit(2);
}

walk(ROOT);

if (failures.length) {
  console.error('Release-secret gate FAILED. Forbidden files found:');
  for (const file of failures) console.error(`  - ${file}`);
  console.error('\nSee 9.5+ Hardening Plan §4. To fix:');
  console.error('  - rotate the secret,');
  console.error('  - delete the file from the working tree,');
  console.error('  - add an entry to PATH_ALLOWLIST only if the file is');
  console.error('    intentionally shipped (with a lifecycle runbook).');
  process.exit(1);
}

console.log('Release-secret gate PASSED. No forbidden secret-bearing files found.');
