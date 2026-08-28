/**
 * P2-3 (PR-A, 2026-08-28 workflows polish): unknown NOTIFICATION_SEND
 * payload types are a producer/consumer contract drift, not routine
 * noise. The dispatcher must log at `error` (not `warn`) and tag the
 * event with `event: 'unknown_payload_type'` so log filters and
 * PostHog insights can pick it up.
 *
 * This test greps the dispatcher source for the required patterns.
 * The runtime contract (alert-on-unknown) is already covered by
 * `notification-dispatch-unknown-type.test.ts` (T-91).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DISPATCH_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'server',
  'workers',
  'jobs',
  'notification-dispatch.job.ts',
);

/** Extract the body of the switch's `default:` case, brace-balanced. */
function extractDefaultBlock(source: string): string {
  const idx = source.indexOf('default:');
  if (idx === -1) return '';
  const open = source.indexOf('{', idx);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return '';
}

describe('notification-dispatch unknown-type log level (P2-3)', () => {
  it('logs unknown-type acks at error level, not warn', () => {
    const source = fs.readFileSync(DISPATCH_PATH, 'utf8');
    const defaultBlock = extractDefaultBlock(source);
    expect(defaultBlock).toMatch(/logger\.error\(/);
    expect(defaultBlock).not.toMatch(/logger\.warn\(/);
  });

  it('tags the unknown-type event for log filtering', () => {
    const source = fs.readFileSync(DISPATCH_PATH, 'utf8');
    const defaultBlock = extractDefaultBlock(source);
    expect(defaultBlock).toMatch(/event:\s*'unknown_payload_type'/);
  });
});
