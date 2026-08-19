// LANGUAGE-AUDIT (2026-08-16) #3: surgical prune of dead `txt*` keys
// from app_hi.arb. The EN ARB has 320 `txt*` keys, the HI ARB has 549
// — the 229 HI-only extras are dead code (never referenced in any
// .dart file under lib/, only in gen/ which is regenerated). The
// i18n_test orphan check filters them out via `!key.startsWith('txt')`
// — that filter is the bug; it hides the orphans. We delete them so
// the test (after the filter is removed) stays honest.
//
// This script parses the ARB as JSON, finds the orphan value keys
// (and their @* metadata pairs), then writes a hand-formatted ARB
// that preserves the original key ordering.
//
// Run from repo root: node scripts/prune_hi_orphans.mjs
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const enPath = path.join(repoRoot, 'flutter', 'lib', 'l10n', 'app_en.arb');
const hiPath = path.join(repoRoot, 'flutter', 'lib', 'l10n', 'app_hi.arb');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const hiJson = JSON.parse(fs.readFileSync(hiPath, 'utf8'));

const enValueKeys = Object.keys(enJson).filter((k) => !k.startsWith('@'));
const hiValueKeys = Object.keys(hiJson).filter((k) => !k.startsWith('@'));

const enSet = new Set(enValueKeys);

// Find HI-only orphan value keys (txt* and any other orphans).
const hiOrphanValueKeys = hiValueKeys.filter((k) => !enSet.has(k));
// Also find the matching @* metadata keys to remove.
const hiOrphanMetaKeys = hiOrphanValueKeys.map((k) => `@${k}`);

console.log(`EN value keys: ${enValueKeys.length}`);
console.log(`HI value keys: ${hiValueKeys.length}`);
console.log(`HI-only orphan value keys: ${hiOrphanValueKeys.length}`);
console.log(`  → of which txt*: ${hiOrphanValueKeys.filter((k) => k.startsWith('txt')).length}`);

// Build a new HI object preserving the original key order, but
// skipping orphans and their @* metadata.
const newHi = {};
for (const key of Object.keys(hiJson)) {
  if (hiOrphanValueKeys.includes(key) || hiOrphanMetaKeys.includes(key)) {
    continue;
  }
  newHi[key] = hiJson[key];
}

// Write the result as a JSON file (Flutter gen-l10n reads JSON
// without strict formatting; l10n.yaml doesn't specify a particular
// indent). Use 2-space indent to match the original style.
const out = JSON.stringify(newHi, null, 2) + '\n';
fs.writeFileSync(hiPath, out, 'utf8');
console.log(`Wrote ${hiPath} (${out.length} bytes)`);

// Verify the result is valid JSON and orphan-free.
const finalJson = JSON.parse(fs.readFileSync(hiPath, 'utf8'));
const finalValueKeys = Object.keys(finalJson).filter((k) => !k.startsWith('@'));
const remainingOrphans = finalValueKeys.filter((k) => !enSet.has(k));
console.log(`Final HI value keys: ${finalValueKeys.length}`);
console.log(`Remaining orphans: ${remainingOrphans.length}`);
if (remainingOrphans.length > 0) {
  console.log('  →', remainingOrphans);
  process.exit(1);
}
console.log('✅ Clean. No orphans remain.');
