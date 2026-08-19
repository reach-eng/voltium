/**
 * PR-152 — Regression guard for the SSRF + secret-split fixes.
 *
 * Two security issues fixed in this PR:
 *   1. `api/admin/workflow-coverage` used `new URL(req.url).origin`
 *      to derive the base URL — an SSRF vector because attackers can
 *      set the `Host` header. Now reads from `env.INTERNAL_API_URL`.
 *   2. `api/internal/debug` used the same `CRON_SECRET` as the cron
 *      routes, so a leaked cron secret exposed the debug surface.
 *      Now uses a dedicated `DEBUG_SECRET`.
 *
 * This test asserts:
 *   - workflow-coverage no longer reads from `req.url`
 *   - workflow-coverage no longer forwards the request cookie
 *   - workflow-coverage reads from `env.INTERNAL_API_URL`
 *   - internal/debug uses `env.DEBUG_SECRET` (NOT `env.CRON_SECRET`)
 *   - env.ts exports both `INTERNAL_API_URL` and `DEBUG_SECRET`
 *   - the env.ts header documents the security intent
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REPO = resolve(__dirname, '../../..');
const WORKFLOW = resolve(REPO, 'web/src/app/api/admin/workflow-coverage/route.ts');
const DEBUG = resolve(REPO, 'web/src/app/api/internal/debug/route.ts');
const ENV = resolve(REPO, 'web/src/lib/env.ts');

function src(path: string): string {
  return readFileSync(path, 'utf-8');
}

describe('PR-152: SSRF + secret-split fixes', () => {
  describe('workflow-coverage SSRF fix', () => {
    it('route file exists', () => {
      expect(existsSync(WORKFLOW)).toBe(true);
    });

    it('does NOT derive base URL from req.url.origin (SSRF vector)', () => {
      const s = src(WORKFLOW);
      // The vulnerable pattern was: `new URL(req.url).origin` as a
      // live expression. We strip comments before searching so the
      // PR-152 comment in the source (which mentions the vulnerable
      // pattern by name) doesn't trip the test.
      const code = s
        .split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n');
      expect(code).not.toMatch(/new URL\(req\.url\)\.origin/);
    });

    it('does NOT forward the request cookie to internal fetch()', () => {
      const s = src(WORKFLOW);
      // The vulnerable pattern: `const cookie = req.headers.get('cookie')`
      // followed by forwarding the cookie. The fix sets cookie = null.
      expect(s).not.toMatch(/req\.headers\.get\(['"]cookie['"]\)/);
    });

    it('reads base URL from env.INTERNAL_API_URL (operator-controlled)', () => {
      const s = src(WORKFLOW);
      expect(s).toMatch(/env\.INTERNAL_API_URL/);
      expect(s).toMatch(/env\.NEXT_PUBLIC_APP_URL/);
    });

    it('has a PR-152 comment explaining the SSRF fix', () => {
      const s = src(WORKFLOW);
      expect(s).toMatch(/PR-152/);
      expect(s).toMatch(/SSRF/);
    });
  });

  describe('internal/debug secret split', () => {
    it('route file exists', () => {
      expect(existsSync(DEBUG)).toBe(true);
    });

    it('uses env.DEBUG_SECRET, NOT env.CRON_SECRET', () => {
      const s = src(DEBUG);
      expect(s).toMatch(/env\.DEBUG_SECRET/);
      // The route should not reference env.CRON_SECRET anymore.
      expect(s).not.toMatch(/env\.CRON_SECRET/);
    });

    it('fails closed when DEBUG_SECRET is not configured (503)', () => {
      const s = src(DEBUG);
      expect(s).toMatch(/DEBUG_SECRET not configured/);
      expect(s).toMatch(/status:\s*503/);
    });

    it('has a PR-152 comment explaining the secret split', () => {
      const s = src(DEBUG);
      expect(s).toMatch(/PR-152/);
      expect(s).toMatch(/DEBUG_SECRET/);
    });
  });

  describe('env.ts schema', () => {
    it('exports INTERNAL_API_URL', () => {
      const s = src(ENV);
      expect(s).toMatch(/INTERNAL_API_URL:\s*z\.string\(\)\.url\(\)\.optional\(\)/);
    });

    it('exports DEBUG_SECRET', () => {
      const s = src(ENV);
      expect(s).toMatch(/DEBUG_SECRET:\s*z\.string\(\)\.optional\(\)/);
    });

    it('documents the PR-152 security intent in env.ts', () => {
      const s = src(ENV);
      expect(s).toMatch(/PR-152/);
    });
  });
});
