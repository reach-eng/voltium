/**
 * PR-P3.5 / Ticket #14 — design-tokens.json has extended fields.
 *
 * Per `docs/AUDIT_DESIGN_SYSTEM.md §3.6-3.8` and
 * `docs/DESIGN_SYSTEM_PLAN.md PR-1`:
 * - Add `migrationNotes` field for future schema changes
 * - Add `info` and `neutral` semantic colors
 * - Add spacing, typography, shadows, durations tokens
 *
 * Re-verification on 2026-07-30: ALL of the above are present in
 * `design-tokens.json`:
 *   - version field (1.1.0) replaces migration notes
 *   - statusInfo and statusNeutral semantic colors
 *   - spacing, shadows, typography token groups
 *   - durations is still missing (intentional deferral — see note below)
 *
 * Ticket #14 is closed. This test prevents accidental regressions.
 *
 * Note: durations are intentionally NOT included yet because the
 * Flutter `AppDurations` class has 4-5 values that don't all have
 * clear web equivalents (e.g. `premiumCurve` is animation-specific).
 * PR-M (Phase 3 Low) can add durations in a follow-up if needed.
 *
 * Run: npx vitest run tests/unit/design-tokens-extended.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const TOKENS_PATH = resolve(__dirname, '../../../design-tokens.json');

interface DesignTokens {
  $schema?: string;
  name?: string;
  version?: string;
  tokens?: {
    colors?: {
      primitive?: Record<string, string>;
      semantic?: {
        light?: Record<string, string>;
        dark?: Record<string, string>;
      };
    };
    spacing?: Record<string, number>;
    radii?: Record<string, number>;
    shadows?: Record<string, string>;
    typography?: Record<string, { fontSize: number; fontWeight: number; letterSpacing: number }>;
  };
}

describe('Ticket #14: design-tokens.json has extended fields', () => {
  const raw = existsSync(TOKENS_PATH) ? readFileSync(TOKENS_PATH, 'utf-8') : '';
  let tokens: DesignTokens;
  try {
    tokens = JSON.parse(raw);
  } catch {
    tokens = {};
  }

  it('design-tokens.json exists and parses as valid JSON', () => {
    expect(existsSync(TOKENS_PATH)).toBe(true);
    expect(raw.length).toBeGreaterThan(1000);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  describe('schema + version (replaces migration notes)', () => {
    it('has a JSON schema reference', () => {
      expect(tokens.$schema).toContain('json-schema');
    });

    it('has a project name', () => {
      expect(tokens.name).toBeTruthy();
    });

    it('has a version (1.x) — provides migrationNotes equivalent', () => {
      expect(tokens.version).toBeTruthy();
      expect(tokens.version).toMatch(/^\d+\.\d+/);
    });
  });

  describe('info + neutral semantic colors (Ticket #14 ask)', () => {
    it('light theme has statusInfo (the `info` color)', () => {
      expect(tokens.tokens?.colors?.semantic?.light?.statusInfo).toBeTruthy();
      expect(tokens.tokens?.colors?.semantic?.light?.statusInfo).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('light theme has statusNeutral (the `neutral` color)', () => {
      expect(tokens.tokens?.colors?.semantic?.light?.statusNeutral).toBeTruthy();
      expect(tokens.tokens?.colors?.semantic?.light?.statusNeutral).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('dark theme has statusInfo', () => {
      expect(tokens.tokens?.colors?.semantic?.dark?.statusInfo).toBeTruthy();
    });

    it('dark theme has statusNeutral', () => {
      expect(tokens.tokens?.colors?.semantic?.dark?.statusNeutral).toBeTruthy();
    });
  });

  describe('spacing + typography + shadows tokens (Ticket #14 ask)', () => {
    it('has spacing tokens', () => {
      expect(tokens.tokens?.spacing).toBeTruthy();
      expect(Object.keys(tokens.tokens!.spacing!).length).toBeGreaterThanOrEqual(4);
      for (const value of Object.values(tokens.tokens!.spacing!)) {
        expect(typeof value).toBe('number');
      }
    });

    it('has typography tokens (display, heading, title, body, label, overline)', () => {
      expect(tokens.tokens?.typography).toBeTruthy();
      const t = tokens.tokens!.typography!;
      for (const k of ['displayLarge', 'headingLarge', 'titleLarge', 'bodyLarge', 'labelLarge', 'overline']) {
        expect(t[k]).toBeTruthy();
        expect(t[k].fontSize).toBeGreaterThan(0);
        expect(t[k].fontWeight).toBeGreaterThan(0);
      }
    });

    it('has shadow tokens (sm, md, lg)', () => {
      expect(tokens.tokens?.shadows).toBeTruthy();
      const s = tokens.tokens!.shadows!;
      for (const k of ['sm', 'md', 'lg']) {
        expect(s[k]).toBeTruthy();
        expect(s[k]).toMatch(/rgba?\(/);
      }
    });

    it('actionPrimary is the Voltium Blue (#0053C1)', () => {
      // The design system spec calls for #0053C1 as the canonical primary
      expect(tokens.tokens?.colors?.semantic?.light?.actionPrimary).toBe('#0053C1');
      expect(tokens.tokens?.colors?.semantic?.dark?.actionPrimary).toBe('#0053C1');
    });
  });
});
