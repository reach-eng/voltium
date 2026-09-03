/**
 * Design Token Sync Checker (PR-92 / DS-T-2)
 *
 * Validates that `web/src/app/globals.css` --color-vf-* declarations
 * match the corresponding tokens in `design-tokens.json`. Catches
 * cross-platform brand drift that would otherwise ship silently.
 *
 * Exit code 0 on match; exit code 1 with a diff on mismatch.
 *
 * Maps at minimum:
 *   --color-vf-primary      ↔ tokens.colors.primitive.blue500
 *   --color-vf-success      ↔ tokens.colors.primitive.emerald500
 *   --color-vf-warning      ↔ tokens.colors.primitive.amber500
 *   --color-vf-info         ↔ tokens.colors.primitive.blue500
 *   --color-vf-error (or destructive) ↔ tokens.colors.primitive.rose500
 */

import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const cssPath = path.join(rootDir, 'web', 'src', 'app', 'globals.css');
const tokensPath = path.join(rootDir, 'design-tokens.json');

// Token map: CSS variable name -> design-tokens.json path (dot-separated)
const TOKEN_MAP: Record<string, string[]> = {
  '--color-vf-primary': ['tokens', 'colors', 'primitive', 'blue500'],
  '--color-vf-success': ['tokens', 'colors', 'primitive', 'emerald500'],
  '--color-vf-warning': ['tokens', 'colors', 'primitive', 'amber500'],
  '--color-vf-info': ['tokens', 'colors', 'semantic', 'light', 'statusInfo'],
  '--color-vf-error': ['tokens', 'colors', 'primitive', 'rose500'],
};

function normalizeHex(value: string): string {
  // Normalize to 6-digit uppercase hex without the # prefix.
  let v = value.trim().toLowerCase();
  if (v.startsWith('#')) v = v.slice(1);
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  if (v.length === 8) v = v.slice(0, 6); // strip alpha
  return v.toUpperCase();
}

function readNested(obj: any, path: string[]): string | undefined {
  let cur = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function main() {
  if (!fs.existsSync(cssPath)) {
    console.error(`[sync-tokens] CSS file not found at ${cssPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(tokensPath)) {
    console.error(`[sync-tokens] design-tokens.json not found at ${tokensPath}`);
    process.exit(1);
  }

  const css = fs.readFileSync(cssPath, 'utf8');
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

  // Extract `--color-vf-X: <value>;` declarations
  const declRe = /--color-vf-([\w-]+)\s*:\s*([^;]+);/g;
  const cssValues = new Map<string, string>();
  for (const m of css.matchAll(declRe)) {
    const name = `--color-vf-${m[1]}`;
    cssValues.set(name, m[2].trim());
  }

  const errors: string[] = [];

  for (const [cssVar, tokenPath] of Object.entries(TOKEN_MAP)) {
    const cssVal = cssValues.get(cssVar);
    if (!cssVal) {
      // Could be a reference like var(--color-vf-primary) — that's fine.
      if (!css.includes(`var(${cssVar})`)) {
        errors.push(`MISSING in globals.css: ${cssVar}`);
      }
      continue;
    }
    const tokenVal = readNested(tokens, tokenPath);
    if (!tokenVal) {
      errors.push(`MISSING in design-tokens.json: ${tokenPath.join('.')}`);
      continue;
    }
    if (normalizeHex(cssVal) !== normalizeHex(tokenVal)) {
      errors.push(
        `MISMATCH ${cssVar}: css="${cssVal}" vs token="${tokenVal}" (path=${tokenPath.join('.')})`
      );
    }
  }

  if (errors.length > 0) {
    console.error('[sync-tokens] Token sync FAILED:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`[sync-tokens] OK — ${Object.keys(TOKEN_MAP).length} tokens in sync.`);
}

main();
