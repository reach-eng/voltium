/**
 * Test for .github/workflows/flutter-ci-cd.yml (PR-141 / INF-CI/CD-7)
 * ------------------------------------------------------------------
 * The build-debug APK upload step at .github/workflows/flutter-ci-cd.yml:150-154
 * had no `retention-days`, defaulting to 90 days. At 1+ build per day that's
 * ~90 debug APKs (~5 GB) retained per month. PR-141 caps it at 7 days.
 *
 * These tests guard against future workflow edits removing the cap.
 * Pure node-side parse — no GitHub Actions runner required.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const WORKFLOW_PATH = resolve(__dirname, '../../../.github/workflows/flutter-ci-cd.yml');

describe('.github/workflows/flutter-ci-cd.yml (PR-141 / INF-CI/CD-7)', () => {
  const content = existsSync(WORKFLOW_PATH) ? readFileSync(WORKFLOW_PATH, 'utf-8') : '';
  const lines = content.split('\n');

  it('the workflow file exists', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('contains the Upload APK step', () => {
    expect(content).toMatch(/-\s+name:\s+Upload\s+APK\b/);
  });

  it('the Upload APK step uploads a debug APK path', () => {
    expect(content).toContain('flutter/build/app/outputs/flutter-apk/app-debug.apk');
  });

  it('the Upload APK step sets retention-days: 7 (PR-141)', () => {
    // Find the Upload APK step block and check it has retention-days: 7
    // within the next ~6 lines (the `with:` block).
    const uploadIdx = lines.findIndex((l) => /-\s+name:\s+Upload\s+APK\b/.test(l));
    expect(uploadIdx, 'Upload APK step must exist').toBeGreaterThan(-1);
    const block = lines.slice(uploadIdx, uploadIdx + 10).join('\n');
    // Accept `retention-days: 7` (preferred) or `retention-days: 7 # comment`.
    expect(block).toMatch(/^\s*retention-days:\s*7\b/m);
  });

  it('the retention cap is at most 7 days (regression guard for default drift)', () => {
    // The cap must not be silently relaxed back to 30 / 90 in a future
    // edit. Read the value as a number and assert <= 7.
    const m = content.match(/^\s*retention-days:\s*(\d+)\b/m);
    expect(m, 'retention-days must be set explicitly').not.toBeNull();
    const days = Number(m![1]);
    expect(days).toBeLessThanOrEqual(7);
  });
});
