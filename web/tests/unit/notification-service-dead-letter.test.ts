/**
 * N-2 (PR-C, 2026-08-28 workflows polish): when an FCM push hits an
 * error, the notification service should surface the failure to
 * PostHog as a `fcm_push_error` event. Without this, on-call
 * engineers have to grep logs to find out which notifications
 * never landed.
 *
 * The T-95 work (4xx-vs-transient classification) is not yet
 * shipped, so the current implementation fires a single event
 * name for both dead-letter (4xx) and transient (5xx / network)
 * errors. Once T-95 lands, this can split into two event names.
 *
 * This is a source-grep test. The real Prisma client is wired in
 * via `db.ts` and the FCM helper is wired in via `fcm.ts`, both
 * of which would require a deeper mock harness (DB + Firebase
 * Admin) to exercise at runtime. Source-grep is sufficient for
 * the user-visible behavior: a `posthog.capture` call in the
 * catch block.
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
  const blockStart = catchStart + '} '.length; // start of the `catch (...)` clause
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

describe('notification service dead-letter counter (N-2)', () => {
  const source = fs.readFileSync(NOTIF_PATH, 'utf8');
  const catchBlock = extractCreateAndSendCatchBlock(source);

  it('createAndSend has a catch block that fires PostHog', () => {
    expect(catchBlock).toBeTruthy();
    expect(catchBlock).toMatch(/posthog\.capture\(/);
  });

  it('emits the fcm_push_error event with the right properties', () => {
    expect(catchBlock).toMatch(/['"]fcm_push_error['"]/);
    // Each property is a separate match — they live in an object literal
    // that may span many lines, so a single non-greedy match across the
    // call is unreliable. We just verify the names are present.
    expect(catchBlock).toMatch(/riderId/);
    expect(catchBlock).toMatch(/title/);
    // The object uses shorthand `type,` not `type: type,`, so match
    // on a comma-followed line (i.e. it's the last property before
    // the closing brace of the object literal).
    expect(catchBlock).toMatch(/type,/);
    expect(catchBlock).toMatch(/status:/);
    expect(catchBlock).toMatch(/error:/);
  });

  it('imports posthog from the canonical client', () => {
    expect(source).toMatch(
      /import\s*\{\s*posthog\s*\}\s*from\s*['"]\.\/posthog-client['"]/,
    );
  });
});
