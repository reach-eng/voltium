/**
 * Secret Rotation CLI Entrypoint (PR-94a / INF-CI/CD-3)
 * ---------------------------------------------------------
 * Wraps `checkSecretRotation()` so the nightly CI job can:
 *   1. Detect stale secrets deterministically.
 *   2. Exit 1 on any stale key (so the CI failure step fires alerts).
 *   3. Exit 0 on a clean rotation window.
 *
 * The previous invocation `npx tsx src/lib/secret-rotation.ts` just
 * evaluated the module and exited 0 — stale secrets were never reported.
 *
 * Exposes `runSecretRotationCheck()` for unit tests so the script body
 * is exercised directly (no `eval` / dynamic-import tricks).
 */

import { checkSecretRotation, bootstrapRotationRecords } from '../web/src/lib/secret-rotation';

export interface RotationCheckOutcome {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
  staleKeys: string[];
}

export async function runSecretRotationCheck(): Promise<RotationCheckOutcome> {
  let results = await checkSecretRotation();
  const uninitialized = results.filter((r) => r.daysSinceRotation === null);

  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest && uninitialized.length > 0 && (process.env.CI || process.argv.includes('--bootstrap'))) {
    process.stdout.write(`[secret-rotation] Bootstrapping ${uninitialized.length} uninitialized secret record(s) for CI...\n`);
    await bootstrapRotationRecords();
    results = await checkSecretRotation();
  }

  const stale = results.filter((r) => r.isStale);

  if (stale.length === 0) {
    const stdout = 'All secrets within rotation window\n';
    process.stdout.write(stdout);
    return { exitCode: 0, stdout, stderr: '', staleKeys: [] };
  }

  // Deterministic, machine-parseable summary on stderr — one line per
  // stale key plus its age + policy. Operators (and Slack message
  // formatters) can grep this output without parsing JSON.
  const stderrLines: string[] = [];
  for (const r of stale) {
    const age = r.daysSinceRotation === null ? 'never-rotated' : `${r.daysSinceRotation}d`;
    const line = `STALE ${r.key} age=${age} maxAge=${r.maxAgeDays}d\n`;
    stderrLines.push(line);
    process.stderr.write(line);
  }
  const summary = `\n[secret-rotation] ${stale.length} of ${results.length} secret(s) are stale.\n`;
  stderrLines.push(summary);
  process.stderr.write(summary);

  return {
    exitCode: 1,
    stdout: '',
    stderr: stderrLines.join(''),
    staleKeys: stale.map((r) => r.key),
  };
}

async function main(): Promise<void> {
  try {
    const outcome = await runSecretRotationCheck();
    process.exit(outcome.exitCode);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[secret-rotation] check failed: ${message}\n`);
    process.exit(2);
  }
}

// Only run the CLI when this file is invoked directly (not when imported
// by a test). We can't rely on `require.main === module` because the file
// is a TS module evaluated by tsx, so we use a process-arg check.
const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('check-secret-rotation.ts') ||
    process.argv[1].endsWith('check-secret-rotation.js') ||
    process.argv[1].endsWith('check-secret-rotation'));

if (invokedDirectly) {
  void main();
}
