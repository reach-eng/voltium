#!/usr/bin/env node
/**
 * TEST-STRATEGY-AUDIT T-P1-5 (2026-08-08): "no-trivial-tests" linter.
 *
 * The 85%-line-coverage gate catches "this function was never called"
 * but not "this function was called with no assertions." The 3
 * placeholder golden tests in `flutter/test/features/{dashboard,
 * profile,wallet}/presentation/screens/*_golden_test.dart` demonstrated
 * the gap: they `return;` before any assertion, and CI still reports
 * them as passing.
 *
 * The specific failure mode this linter targets is the EARLY-RETURN
 * placeholder pattern:
 *
 *   testWidgets('foo', (tester) async {
 *     return;                  // <-- early return, all code below is dead
 *     expect(find.text('x'), findsOneWidget);
 *   });
 *
 * Detection: for every `it(` / `test(` / `testWidgets(` declaration,
 * check the body (lines until the matching `});`). If a `return;`
 * statement appears on its own line, AND the body extends past
 * that return with more code, the test is a placeholder.
 *
 * Output is a non-zero exit code on any violation, so it can be
 * wired into CI. Run via:
 *
 *   node web/scripts/lint-no-trivial-tests.js [files...]
 *
 * Pass file paths to limit the scan. With no args, scans all
 * .test.ts files under web/tests and all _test.dart files under
 * flutter/test and flutter/integration_test.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Walk a directory recursively, returning all files matching the
 * given suffix.
 */
function walk(dir, suffix) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, suffix));
    } else if (entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Find the start line of every `it(` / `test(` / `testWidgets(`
 * declaration in the file. Returns an array of { line, name, kind }.
 * `describe` / `context` / `group` are deliberately NOT included —
 * they're test-grouping constructs, not test cases.
 */
function findTestDeclarations(content) {
  const lines = content.split('\n');
  const re = /\b(it|test|testWidgets|testWidgetsWith)\s*\(/;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      out.push({ line: i + 1, name: lines[i].trim(), kind: RegExp.$1 });
    }
  }
  return out;
}

/**
 * Given the line number where a test starts, find the body
 * (lines from the start to the matching `});` at the top level).
 * Returns an array of body lines.
 */
function findTestBody(lines, startLine) {
  let depth = 0;
  let started = false;
  const body = [];
  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];
    body.push(line);
    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; }
    }
    if (started && depth === 0) {
      return body;
    }
  }
  return body;
}

/**
 * Heuristic: detect the early-return placeholder pattern. Returns
 * a violation if the body contains an UNCONDITIONAL bare `return;`
 * statement on its own line, AND has substantive code after that
 * return. A `return;` inside an `if (cond) { return; }` block is
 * a legitimate skip-on-setup-failure pattern, not a placeholder.
 */
function isEarlyReturnPlaceholder(body) {
  // Track braces so we know when we're inside an `if` block.
  let depth = 0;
  let seenReturn = false;
  for (const line of body) {
    const trimmed = line.trim();

    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }

    if (seenReturn) {
      if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        return true;
      }
    } else if (
      // Bare `return;` is unconditional only when depth === 1 (the
      // test body's top level). A `return;` inside an `if` (depth > 1)
      // is a legitimate conditional skip.
      depth === 1 &&
      /^return\s*;\s*$/.test(trimmed)
    ) {
      seenReturn = true;
    }
  }
  return false;
}

function main() {
  const args = process.argv.slice(2);
  let files = args;
  if (files.length === 0) {
    files = [
      ...walk(path.join(REPO_ROOT, 'web', 'tests'), '.test.ts'),
      ...walk(path.join(REPO_ROOT, 'flutter', 'test'), '_test.dart'),
      ...walk(path.join(REPO_ROOT, 'flutter', 'integration_test'), '_test.dart'),
    ];
  } else {
    files = args.map((f) => path.resolve(REPO_ROOT, f));
  }

  let totalViolations = 0;
  const summary = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const tests = findTestDeclarations(content);
    if (tests.length === 0) continue;

    const violations = [];
    for (const t of tests) {
      const body = findTestBody(lines, t.line);
      if (isEarlyReturnPlaceholder(body)) {
        violations.push({ line: t.line, name: t.name, kind: t.kind });
      }
    }
    if (violations.length > 0) {
      totalViolations += violations.length;
      summary.push({
        file: path.relative(REPO_ROOT, file),
        violations,
      });
    }
  }

  if (totalViolations === 0) {
    console.log(`[lint-no-trivial-tests] OK — no placeholder tests found.`);
    process.exit(0);
  }

  console.error(
    `[lint-no-trivial-tests] FAIL — ${totalViolations} placeholder test(s) ` +
      `(early \`return;\` followed by unreachable code):`,
  );
  for (const entry of summary) {
    console.error(`\n  ${entry.file}`);
    for (const v of entry.violations) {
      console.error(`    line ${v.line}: ${v.name}`);
    }
  }
  console.error(
    `\nFix: either remove the early \`return;\` so the test body actually ` +
      `runs, or delete the test entirely. The placeholder pattern was the ` +
      `root cause of 3 phantom tests in the Flutter suite.`,
  );
  process.exit(1);
}

main();
