// Validation gap analysis: routes that mutate but don't use Zod or inline checks.
import fs from 'node:fs';
import path from 'node:path';

const root = 'D:/voltium/web/src/app/api';
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'route.ts') files.push(p);
  }
}
walk(root);

const results = files.map((f) => {
  const c = fs.readFileSync(f, 'utf8');
  const rel = f.replace(/^.*[\\/]app[\\/]api[\\/]/, '').replace(/[\\/]route\.ts$/, '').replace(/\\/g, '/');
  const verbs = [];
  for (const v of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    if (new RegExp('export (async )?function ' + v + '\\b').test(c)) verbs.push(v);
    if (new RegExp('export const ' + v + '\\s*=').test(c)) verbs.push(v);
  }
  const hasZod = /validateBody|VALIDATION_MAP|\.safeParse/.test(c);
  const hasInline = /errors\.badRequest\([^)]*required/.test(c);
  return { path: '/api/' + rel, verbs: verbs.join(','), zod: hasZod, inline: hasInline };
});

const mutating = results.filter((r) => r.verbs.split(',').some((v) => v && v !== 'GET'));
const noZod = mutating.filter((r) => !r.zod);
const realGaps = noZod.filter((r) => !r.inline);
const inlineOnly = noZod.filter((r) => r.inline);

console.log('MUTATING ROUTES:', mutating.length);
console.log('NO ZOD:', noZod.length);
console.log('REAL GAPS (no Zod, no inline):', realGaps.length);
console.log('INLINE-ONLY CHECKS:', inlineOnly.length);
console.log('\n--- REAL GAPS ---');
for (const r of realGaps) console.log('  ', r.path, '[' + r.verbs + ']');
console.log('\n--- INLINE-ONLY (manual but no Zod) ---');
for (const r of inlineOnly) console.log('  ', r.path, '[' + r.verbs + ']');
