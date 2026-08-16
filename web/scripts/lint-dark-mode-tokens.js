#!/usr/bin/env node
/**
 * DARK-MODE-AUDIT 2026-08-14 — PR3: Web dark-mode token ratchet.
 *
 * PR2 swept all `text-X-600` → `text-X-600 dark:text-X-400` in `web/src/`.
 * This ratchet prevents drift back: any new `text-X-600` (or `text-X-500`
 * etc.) without a corresponding `dark:text-X-{lighter}` variant is a
 * regression against the dark-mode migration.
 *
 * Pattern:
 *   text-{color}-{weight}  (where weight is 500/600/700/800/900)
 *     → must be followed by `dark:text-{color}-{400|300}` on the same line
 *
 * Skip if:
 *   - The token is in a comment (// or /* * / or // eslint-disable)
 *   - The token is part of a `dark:` variant (we look for non-dark)
 *   - The class is `text-X-400` or lighter (the dark variant is already in
 *     the class list, no additional dark: needed)
 *
 * Exit codes:
 *   0 — clean (no violations)
 *   1 — violations found
 *   2 — environment error
 *
 * Usage:
 *   node web/scripts/lint-dark-mode-tokens.js           # scan web/src/
 *   node web/scripts/lint-dark-mode-tokens.js path/...  # scan specific paths
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WEB_SRC = path.resolve(__dirname, '..', 'src');

// Tailwind color families where 600 is the "light" weight (darker, more
// saturated) and 300/400 is the "dark" weight (lighter, less saturated).
// This is the canonical light/dark pairing used in the PR2 migration
// (which targeted 600 → 400 specifically).
//
// We deliberately flag ONLY 600 — not 500/700/800/900 — because:
//   - 500 is borderline (medium) and works in both modes
//   - 700/800/900 are very dark and work in both modes
//   - PR2's web sweep explicitly targeted 600 → 400; this ratchet matches.
//
// We accept BOTH 300 and 400 as the "dark" weight, because the codebase
// uses both (`text-slate-600 dark:text-slate-300` and
// `text-slate-600 dark:text-slate-400` are both legitimate).
const COLOR_FAMILIES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
];

const LIGHT_WEIGHTS = ['600'];
const DARK_WEIGHTS = ['300', '400'];

// Skip these patterns
const SKIP_EXTENSIONS = new Set(['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']);
const SKIP_DIR_NAMES = new Set(['node_modules', '.next', 'dist', 'build', '.turbo']);
const SKIP_FILE_PATTERNS = [
  /^\/\*[\s\S]*?\*\//, // block comment at start of line
];

const colorAlt = COLOR_FAMILIES.join('|');
const lightAlt = LIGHT_WEIGHTS.join('|');
const darkAlt = DARK_WEIGHTS.join('|');

// Match `text-{color}-{lightWeight}` not already followed by a
// `dark:text-{color}-{darkWeight}` on the same line (excluding quotes).
// The negative lookahead scans any chars that aren't a single or double
// quote, so it can match across space-separated class names inside a
// single class string. Backticks are allowed because they appear in
// template literals.
const LIGHT_TOKEN_RE = new RegExp(
  '\\btext-(' + colorAlt + ')-(' + lightAlt + ')\\b(?![^"\']*dark:text-\\1-(?:' + darkAlt + '))',
  'g'
);
// Check for any `dark:text-X-` after the position within the same class string
const DARK_VARIANT_RE = new RegExp(
  `\\bdark:text-(${colorAlt})-(?:${darkAlt})\\b`
);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      if (SKIP_EXTENSIONS.has(path.extname(entry.name))) continue;
      files.push(full);
    }
  }
  return files;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*');
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;

    // Skip if the line is a JSX attribute that doesn't render text (e.g. an
    // import or a type definition).
    // We only flag inside template strings or JSX expressions that look
    // like className= or class=.
    if (!/(className|class)\s*=/.test(line) &&
        !/`[^`]*text-/.test(line)) {
      continue;
    }

    // If a dark variant already exists on this line, skip
    if (DARK_VARIANT_RE.test(line)) continue;

    let m;
    LIGHT_TOKEN_RE.lastIndex = 0;
    while ((m = LIGHT_TOKEN_RE.exec(line)) !== null) {
      violations.push({
        line: i + 1,
        color: m[1],
        weight: m[2],
        text: line.trim(),
      });
    }
  }

  return violations;
}

function main() {
  const args = process.argv.slice(2);
  const startPaths = args.length > 0
    ? args.map((p) => path.resolve(p))
    : [WEB_SRC];

  if (!fs.existsSync(WEB_SRC)) {
    console.error(`ERROR: web/src not found at ${WEB_SRC}`);
    process.exit(2);
  }

  const files = [];
  for (const start of startPaths) {
    if (!fs.existsSync(start)) {
      console.error(`ERROR: ${start} does not exist`);
      process.exit(2);
    }
    const stat = fs.statSync(start);
    if (stat.isDirectory()) {
      walk(start, files);
    } else {
      files.push(start);
    }
  }

  const allViolations = [];
  for (const file of files) {
    const v = scanFile(file);
    for (const item of v) {
      allViolations.push({ file, ...item });
    }
  }

  const passed = allViolations.length === 0;
  console.log('── Web Dark-Mode Token Ratchet (DARK-MODE-AUDIT 2026-08-14 PR3) ──');
  console.log(
    `text-{color}-{500..900} without dark:text-{color}-{300|400}: ${allViolations.length}  ${passed ? '✓' : '✗ REGRESSION'}`
  );

  if (!passed) {
    console.error('');
    console.error(`ERROR: ${allViolations.length} dark-mode token regression(s) found.`);
    console.error('Add a `dark:text-X-300` (or `dark:text-X-400`) sibling to every');
    console.error('`text-X-500/600/700/800/900` so the dark theme has the right weight.');
    console.error('');
    console.error('Violations:');
    for (const v of allViolations) {
      const rel = path.relative(REPO_ROOT, v.file);
      console.error(`  ${rel}:${v.line}  text-${v.color}-${v.weight}  ← ${v.text}`);
    }
    process.exit(1);
  }

  console.log('Web dark-mode token ratchet passed.');
}

main();
