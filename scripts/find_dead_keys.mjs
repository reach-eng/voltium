// Find dead EN ARB keys (no Dart call site).
// Run from repo root: node scripts/find_dead_keys.mjs
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const libDir = path.join(repoRoot, 'flutter', 'lib');
const arbEn = path.join(repoRoot, 'flutter', 'lib', 'l10n', 'app_en.arb');

const en = JSON.parse(fs.readFileSync(arbEn, 'utf8'));
const enKeys = Object.keys(en).filter((k) => !k.startsWith('@'));

// Recursively read all .dart files under lib/ except gen/.
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'gen') continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.dart')) {
      out.push(full);
    }
  }
  return out;
}
const dartFiles = walk(libDir);
const allText = dartFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

function snakeToCamel(snake) {
  const parts = snake.split('_');
  if (parts.length === 1) return snake;
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.length === 0) continue;
    out += p[0].toUpperCase() + p.substring(1);
  }
  return out;
}

const live = [];
const dead = [];
for (const k of enKeys) {
  const camel = snakeToCamel(k);
  if (allText.includes(k) || allText.includes(camel)) live.push(k);
  else dead.push(k);
}
console.log(`Total: ${enKeys.length}, Live: ${live.length}, Dead: ${dead.length}`);
console.log(`\nLive (${live.length}):`);
for (const k of live) console.log(`  ${k}`);
console.log(`\nDead (${dead.length}):`);
for (const k of dead) console.log(`  ${k}`);

// Write the dead key list to a file for easy reference / re-running
const deadFile = path.join(repoRoot, 'flutter', 'test', 'core', '.i18n_dead_keys.txt');
fs.writeFileSync(deadFile, dead.join('\n') + '\n', 'utf8');
console.log(`\nWrote ${deadFile} (${dead.length} keys)`);
