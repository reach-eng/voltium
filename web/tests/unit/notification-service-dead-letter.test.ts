/**
 * N-2 (PR-C) + T-95 (PR-E, 2026-08-28 workflows deferred): FCM push
 * errors are surfaced to PostHog with the right event name based
 * on the 4xx-vs-transient classification.
 *
 *  - 4xx → `fcm_push_dead_lettered` + `permanent: true` (ack, no retry)
 *  - 5xx → `fcm_push_transient_error` + rethrow (job-queue backoff)
 *  - network (no status code) → `fcm_push_transient_error` + rethrow
 *
 * The previous source-grep test (PR-C) only verified the
 * `fcm_push_error` event name. The T-95 fix splits the bucket
 * into the two real categories.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const NOTIF_PATH = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'lib',
  'notification-service.ts',
);

function extractCreateAndSendCatchBlock(source: string): string {
  // Find the last `} catch (error) { ... }` in the source, which is
  // the catch block of createAndSend. Brace-balanced because the
  // object literal inside `posthog.capture(...)` may contain nested
  // braces that confuse a simple regex.
  const catchStart = source.lastIndexOf('} catch (error) {');
  if (catchStart === -1) return '';
  const blockStart = catchStart + '} '.length;
  const openBrace = source.indexOf('{', blockStart);
  if (openBrace === -1) return '';
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(blockStart, i + 1);
      }
    }
  }
  return '';
}

describe('notification service dead-letter / transient classification (N-2 + T-95)', () => {
  const source = fs.readFileSync(NOTIF_PATH, 'utf8');
  const catchBlock = extractCreateAndSendCatchBlock(source);

  it('createAndSend has a catch block that classifies the FCM error', () => {
    expect(catchBlock).toBeTruthy();
    // T-95: 4xx-vs-transient gate.
    expect(catchBlock).toMatch(/isPermanent/);
    // The PostHog call is still here, but the event name split:
    expect(catchBlock).toMatch(/posthog\.capture\(/);
  });

  it('classifies 4xx as permanent (dead-lettered) and returns permanent: true', () => {
    // The 4xx branch should fire `fcm_push_dead_lettered` and
    // return `{ success: false, error, permanent: true }`.
    expect(catchBlock).toMatch(/['"]fcm_push_dead_lettered['"]/);
    // The return value carries the `permanent: true` flag.
    expect(catchBlock).toMatch(/permanent:\s*true/);
  });

  it('classifies 5xx and network as transient and rethrows', () => {
    // The 5xx / non-4xx branch should fire `fcm_push_transient_error`
    // and re-throw the error.
    expect(catchBlock).toMatch(/['"]fcm_push_transient_error['"]/);
    // The throw statement is present.
    expect(catchBlock).toMatch(/throw\s+error/);
  });

  it('does NOT use the old single-bucket event name (fcm_push_error)', () => {
    // The PR-C event name was `fcm_push_error`. The T-95 fix
    // splits into the two real categories; the old name should
    // not appear in the catch block.
    expect(catchBlock).not.toMatch(/['"]fcm_push_error['"]/);
  });

  it('imports posthog from the canonical client', () => {
    expect(source).toMatch(
      /import\s*\{\s*posthog\s*\}\s*from\s*['"]\.\/posthog-client['"]/,
    );
  });
});
