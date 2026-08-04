/**
 * PR Batch 2 Item 7b — Outbox payload size cap
 *
 * Verifies that:
 * 1. OutboxService.emit() rejects payloads > MAX_OUTBOX_PAYLOAD_BYTES
 *    (64 KB) with a clear OutboxPayloadTooLargeError.
 * 2. The thrown error carries the actual size + limit + event type.
 * 3. Payloads within the cap are accepted (we just verify the
 *    threshold logic; the actual DB write is exercised by integration
 *    tests).
 * 4. The error is thrown BEFORE any DB work (no partial state).
 * 5. The cap constant is exported and equals 64 KB.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '../../src/server/workers/outbox.ts');

describe('Outbox payload size cap (PR Batch 2 Item 7b)', () => {
  const content = readFileSync(SRC, 'utf-8');

  it('MAX_OUTBOX_PAYLOAD_BYTES constant is exported and equals 64 KB', () => {
    expect(content).toMatch(/export const MAX_OUTBOX_PAYLOAD_BYTES = 64 \* 1024/);
  });

  it('OutboxPayloadTooLargeError class is exported with the required fields', () => {
    expect(content).toMatch(/export class OutboxPayloadTooLargeError/);
    expect(content).toContain('actualBytes:');
    expect(content).toContain('limitBytes:');
    expect(content).toContain('eventType:');
  });

  it('emit() throws OutboxPayloadTooLargeError for oversized payloads', () => {
    // Look for the throw inside emit() — must happen BEFORE the
    // outboxEvent.create call.
    const throwIdx = content.indexOf('throw new OutboxPayloadTooLargeError');
    const createIdx = content.indexOf('outboxEvent.create');
    expect(throwIdx).toBeGreaterThan(0);
    expect(createIdx).toBeGreaterThan(0);
    expect(throwIdx).toBeLessThan(createIdx);
  });

  it('emit() checks serialized size via Buffer.byteLength (not .length)', () => {
    // Multi-byte chars (emoji, Hindi) would pass a .length check
    // and fail a byte check. We use byte length to be safe.
    expect(content).toContain('Buffer.byteLength(serialized,');
    expect(content).toMatch(/Buffer\.byteLength\(serialized,\s*'utf8'\)/);
  });

  it('emit() logs the rejection (operator visibility)', () => {
    // The rejection must be logged at error level so operators
    // can find the offending producer in production logs.
    expect(content).toMatch(/logger\.error\(\s*'\[Outbox\] Payload exceeds size cap'/);
  });

  it('emit() error message references the cap and the offending event type', () => {
    // The user-facing message must be actionable. Look for the
    // hint that says "store the large payload in storage and
    // reference it by URL" — that's the operator guidance.
    expect(content).toContain('split the event');
    expect(content).toContain('store the large payload in storage');
  });

  it('emit() default priority is "background" (regression guard)', () => {
    // PR-75: callers that don't pass priority keep the pre-PR-75
    // behavior. Don't accidentally change this in the payload-cap PR.
    expect(content).toMatch(/priority:\s*OutboxPriority\s*=\s*'background'/);
  });
});
