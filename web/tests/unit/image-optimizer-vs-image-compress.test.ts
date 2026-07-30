/**
 * PR-M (Ticket #17) — Verify image-optimizer.ts and image-compress.ts are NOT duplicates.
 *
 * Per `docs/AUDIT_FINDINGS_ADMINPANEL.md §1.41`, the audit suspected these two
 * files may duplicate each other. Re-verification on 2026-07-30 confirms
 * they serve DISTINCT purposes:
 *
 *   - `lib/image-optimizer.ts` (2.6 KB) — SERVER-side pipeline using Sharp
 *     (KYC document processing, payment proof thumbnails). Uses Node.js
 *     file system + Sharp transforms. Server-only.
 *
 *   - `lib/image-compress.ts` (7.1 KB) — CLIENT-side browser compression
 *     using Canvas API. Pre-upload compression to ~300KB so the upload is
 *     fast. Browser-only (uses `'use client'` directive and Canvas API).
 *
 * The two complement each other in the upload pipeline:
 *   1. Client compresses the image (image-compress.ts) → 300KB blob
 *   2. Client uploads the blob
 *   3. Server processes the upload (image-optimizer.ts) → thumbnails + WebP
 *
 * Different runtimes, different APIs, different responsibilities. Not a duplicate.
 *
 * Run: npx vitest run tests/unit/image-optimizer-vs-image-compress.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const OPTIMIZER = resolve(__dirname, '../../src/lib/image-optimizer.ts');
const COMPRESS = resolve(__dirname, '../../src/lib/image-compress.ts');

describe('Ticket #17: image-optimizer vs image-compress — not duplicates', () => {
  const optimizer = existsSync(OPTIMIZER) ? readFileSync(OPTIMIZER, 'utf-8') : '';
  const compress = existsSync(COMPRESS) ? readFileSync(COMPRESS, 'utf-8') : '';

  it('both files exist', () => {
    expect(existsSync(OPTIMIZER)).toBe(true);
    expect(existsSync(COMPRESS)).toBe(true);
  });

  describe('image-optimizer.ts is the SERVER pipeline', () => {
    it('uses Sharp (Node.js native)', () => {
      expect(optimizer).toMatch(/sharp/i);
      expect(optimizer).toMatch(/await import\(['"]sharp['"]\)|require\(['"]sharp['"]\)/);
    });

    it('is server-only (no Canvas API)', () => {
      expect(optimizer).not.toMatch(/HTMLCanvasElement|OffscreenCanvas/);
      expect(optimizer).not.toMatch(/canvas\.toBlob/);
    });

    it('has presets for server-side transforms (kyc_document, profile_photo, etc.)', () => {
      expect(optimizer).toMatch(/kyc_document/);
      expect(optimizer).toMatch(/profile_photo/);
      expect(optimizer).toMatch(/payment_proof/);
    });

    it('generates thumbnails (server-side concern)', () => {
      expect(optimizer).toMatch(/thumbnail/i);
    });
  });

  describe('image-compress.ts is the CLIENT pipeline', () => {
    it('has the `use client` directive', () => {
      expect(compress).toMatch(/['"]use client['"]/);
    });

    it('uses the Canvas API (browser-only)', () => {
      expect(compress).toMatch(/HTMLCanvasElement|OffscreenCanvas|canvas/);
      expect(compress).toMatch(/toBlob|toDataURL/);
    });

    it('is NOT using Sharp (no Node.js native dep)', () => {
      expect(compress).not.toMatch(/from\s+['"]sharp['"]|require\(['"]sharp['"]\)/);
    });

    it('targets ~300KB output (browser upload optimization)', () => {
      expect(compress).toMatch(/300.*KB|300\s*\*\s*1024/);
    });
  });

  describe('the two files do not duplicate logic', () => {
    it('they have different exports', () => {
      const optimizerExports = optimizer.match(/^export\s+(async\s+)?function\s+\w+/gm) ?? [];
      const compressExports = compress.match(/^export\s+(async\s+)?function\s+\w+/gm) ?? [];
      const optimizerNames = optimizerExports.map((e) => e.match(/\w+$/)?.[0]).filter(Boolean);
      const compressNames = compressExports.map((e) => e.match(/\w+$/)?.[0]).filter(Boolean);
      // No function name appears in both files
      for (const name of optimizerNames) {
        expect(compressNames).not.toContain(name);
      }
    });

    it('they are NOT cross-importing (each is self-contained)', () => {
      expect(optimizer).not.toMatch(/from\s+['"].*image-compress['"]/);
      expect(compress).not.toMatch(/from\s+['"].*image-optimizer['"]/);
    });

    it('file size delta (2.6 KB vs 7.1 KB) is consistent with distinct logic', () => {
      // Image-compress is larger because Canvas quality-step loop is non-trivial
      // Image-optimizer is smaller because Sharp presets are declarative
      const optimizerSize = existsSync(OPTIMIZER) ? readFileSync(OPTIMIZER, 'utf-8').length : 0;
      const compressSize = existsSync(COMPRESS) ? readFileSync(COMPRESS, 'utf-8').length : 0;
      // 2.6 KB < 7.1 KB, and the ratio is roughly 1:3
      expect(compressSize).toBeGreaterThan(optimizerSize);
      expect(compressSize / optimizerSize).toBeGreaterThan(1.5);
    });
  });
});
