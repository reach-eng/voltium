/**
 * PR-K.2 — Rider response shape includes `lifecycleStage`.
 *
 * Validates that the backend rider response includes the new
 * `lifecycleStage` field (5-value enum) alongside the legacy
 * `lifecycleStatus` (15-value enum). This is a shape-only test;
 * it doesn't need a running DB.
 *
 * The shape contract: the rider's JSON response (sent to Flutter)
 * must include BOTH fields during the transition window. The Flutter
 * model prefers `lifecycleStage` and falls back to mapping
 * `lifecycleStatus` via `lifecycleStageFromStatus` if the new
 * column is null.
 *
 * Run: npx vitest run tests/unit/riders-lifecycle-stage-shape.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('PR-K.2: Rider response shape includes lifecycleStage', () => {
  const schema = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf-8') : '';

  it('schema has the lifecycleStage column on the Rider model', () => {
    // Find the Rider model block
    const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
    expect(riderMatch).toBeTruthy();
    const riderBody = riderMatch![1];
    // The new column is right next to the legacy one
    expect(riderBody).toMatch(/lifecycleStage\s+RiderLifecycleStage\?/);
  });

  it('schema has the lifecycleStatus column on the Rider model (legacy)', () => {
    const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
    expect(riderMatch).toBeTruthy();
    const riderBody = riderMatch![1];
    expect(riderBody).toMatch(/lifecycleStatus\s+RiderLifecycleStatus/);
  });

  it('lifecycleStatus and lifecycleStage are adjacent columns', () => {
    const riderMatch = schema.match(/model\s+Rider\s*\{([\s\S]*?)\n\}/);
    expect(riderMatch).toBeTruthy();
    const riderBody = riderMatch![1];
    // They should be on consecutive lines
    expect(riderBody).toMatch(
      /lifecycleStatus\s+RiderLifecycleStatus[^\n]*\n\s*lifecycleStage\s+RiderLifecycleStage/
    );
  });

  it('RiderLifecycleStage enum has 5 values', () => {
    const enumMatch = schema.match(
      /enum\s+RiderLifecycleStage\s*\{([^}]+)\}/
    );
    expect(enumMatch).toBeTruthy();
    const values = enumMatch![1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(values).toEqual(['NEW', 'IN_PROGRESS', 'ACTIVE', 'PAUSED', 'CLOSED']);
  });

  it('RiderLifecycleStatus enum has 15 values (legacy, not yet removed)', () => {
    const enumMatch = schema.match(
      /enum\s+RiderLifecycleStatus\s*\{([^}]+)\}/
    );
    expect(enumMatch).toBeTruthy();
    const values = enumMatch![1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(values.length).toBe(15);
  });
});
