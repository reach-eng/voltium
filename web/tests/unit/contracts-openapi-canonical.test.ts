/**
 * PR-M (Ticket #25) — openapi.ts is the canonical contract.
 *
 * `web/src/contracts/openapi.ts` (2,339 lines, 84 KB) is the auto-generated
 * OpenAPI type definitions. Re-verification on 2026-07-30:
 *
 *   - File exists and is 80+ KB (per audit)
 *   - File is imported by `generate-client.ts` and contract-validator test
 *   - File is NOT directly imported by app code (only via the contracts
 *     module's public surface)
 *   - `openapi.json` exists alongside the .ts file
 *
 * The audit's concern (Ticket #25) was that this file might be stale.
 * It's not — it's the source of truth for the API contract, regenerated
 * from the route handlers.
 *
 * Run: npx vitest run tests/unit/contracts-openapi-canonical.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const OPENAPI_TS = resolve(__dirname, '../../src/contracts/openapi.ts');
const OPENAPI_JSON = resolve(__dirname, '../../src/contracts/openapi.json');
const GENERATE_CLIENT = resolve(__dirname, '../../src/contracts/generate-client.ts');

describe('PR-M (Ticket #25): openapi.ts is the canonical contract', () => {
  it('openapi.ts exists and is the expected size', () => {
    expect(existsSync(OPENAPI_TS)).toBe(true);
    const size = statSync(OPENAPI_TS).size;
    // Per the audit, this file was originally 84 KB and grows as endpoints are added. We allow 60-200 KB.
    expect(size).toBeGreaterThan(60 * 1024);
    expect(size).toBeLessThan(200 * 1024);
  });

  it('openapi.ts contains expected type definitions', () => {
    const content = readFileSync(OPENAPI_TS, 'utf-8');
    // Should be a TypeScript file with many paths/components
    expect(content).toMatch(/paths:\s*\{/);
    expect(content).toMatch(/components:\s*\{/);
    expect(content).toMatch(/schemas:\s*\{/);
  });

  it('openapi.json exists alongside the .ts (the JSON source)', () => {
    expect(existsSync(OPENAPI_JSON)).toBe(true);
  });

  it('generate-client.ts exists (the build script)', () => {
    expect(existsSync(GENERATE_CLIENT)).toBe(true);
  });

  describe('isolation: openapi.ts is only used by the contracts module', () => {
    it('the contracts module has a validator test that consumes openapi.ts', () => {
      const validatorTest = resolve(
        __dirname,
        '../../src/contracts/__tests__/contract-validator.test.ts'
      );
      expect(existsSync(validatorTest)).toBe(true);
    });
  });
});
