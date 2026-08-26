#!/usr/bin/env node
/**
 * Self-test for `scripts/check-release-secrets.mjs`.
 *
 * Runs the scanner against three synthetic directory trees and asserts the
 * expected exit code + failure contents for each. This file deliberately
 * avoids `node:test` / `vitest` so it can run in CI without a JS install.
 *
 * Usage:
 *   node tests/unit/check-release-secrets.test.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = 'scripts/check-release-secrets.mjs';

function runScanner(dir) {
  try {
    const out = execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'release-secret-gate-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content ?? '');
  }
  return root;
}

let failed = 0;
function assert(label, cond, detail) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// 1. Clean tree — only allowed files. Scanner should pass.
{
  const root = makeTree({
    'web/.env.example': 'EXAMPLE=1',
    'flutter/assets/certs/voltium-ca.pem': 'CA',
  });
  const r = runScanner(root);
  assert('clean tree passes', r.code === 0, `got exit=${r.code}, out=${r.out}`);
  rmSync(root, { recursive: true, force: true });
}

// 2. Forbidden .env present. Scanner should fail and list it.
{
  const root = makeTree({
    'web/.env': 'JWT_SECRET=abc',
  });
  const r = runScanner(root);
  assert(
    'web/.env fails the gate',
    r.code === 1 && r.out.includes('web/.env'),
    `got exit=${r.code}, out=${r.out}`,
  );
  rmSync(root, { recursive: true, force: true });
}

// 3. .env.example is always allowed.
{
  const root = makeTree({
    'web/.env.example': '',
    'web/.env.staging.example': '',
  });
  const r = runScanner(root);
  assert('*.example files are allowed', r.code === 0, `got exit=${r.code}, out=${r.out}`);
  rmSync(root, { recursive: true, force: true });
}

// 4. Forbidden keystore. Scanner should fail and list it.
{
  const root = makeTree({
    'flutter/android/app/voltium-release.jks': 'jks',
  });
  const r = runScanner(root);
  assert(
    '*.jks fails the gate',
    r.code === 1 && r.out.includes('voltium-release.jks'),
    `got exit=${r.code}, out=${r.out}`,
  );
  rmSync(root, { recursive: true, force: true });
}

// 5. Allow-list: flutter/assets/certs/voltium-ca.pem is intentionally shipped.
{
  const root = makeTree({
    'flutter/assets/certs/voltium-ca.pem': 'CA',
  });
  const r = runScanner(root);
  assert(
    'allow-listed production CA is permitted',
    r.code === 0,
    `got exit=${r.code}, out=${r.out}`,
  );
  rmSync(root, { recursive: true, force: true });
}

// 6. Nested forbidden file under a non-skipped directory.
{
  const root = makeTree({
    'some/deep/path/.env.production': '',
  });
  const r = runScanner(root);
  assert(
    '.env.production nested is detected',
    r.code === 1 && r.out.includes('.env.production'),
    `got exit=${r.code}, out=${r.out}`,
  );
  rmSync(root, { recursive: true, force: true });
}

// 7. node_modules + .git are skipped — no false positives.
{
  const root = makeTree({
    'node_modules/some-pkg/.env': 'should-be-skipped',
    '.git/config': 'should-be-skipped',
  });
  const r = runScanner(root);
  assert('node_modules / .git are skipped', r.code === 0, `got exit=${r.code}, out=${r.out}`);
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log('\nAll release-secret-gate self-tests passed.');
