/**
 * RMP Sprint 1 T1.6 (2026-08-27) — env-guard regression tests.
 *
 * The guard runs at server startup and refuses to boot if any of the
 * production invariants is violated. These tests pin every branch:
 *
 *   - APP_ENV is not in the allowed set
 *   - APP_ENV=development: most checks are skipped (dev ergonomics)
 *   - APP_ENV=staging: dev-bypass flags must be false
 *   - APP_ENV=production: every required secret must be >= 32 bytes
 *   - BACKUP_ENCRYPTION_ENABLED must be 'true' in non-dev
 *   - DATABASE_URL must include sslmode=require in non-dev
 *   - Distinctness across cross-protocol HMAC secrets
 *   - assertEnvInvariants throws on the first failure
 *   - assertEnvInvariants is silent on a clean development env
 *     (so the test runner can keep going)
 */
import { describe, it, expect } from 'vitest';
import {
  checkEnvInvariants,
  assertEnvInvariants,
} from '@/server/security/env-guard';

const STRONG_SECRET_A = 'a'.repeat(32);
const STRONG_SECRET_B = 'b'.repeat(32);
const STRONG_SECRET_C = 'c'.repeat(32);
const STRONG_SECRET_D = 'd'.repeat(32);

function baseEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'development',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: STRONG_SECRET_A,
    FCM_COMMAND_HMAC_SECRET: STRONG_SECRET_B,
    CRON_SECRET: STRONG_SECRET_C,
    WORKER_SECRET: STRONG_SECRET_D,
    BACKUP_ENCRYPTION_ENABLED: 'false',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe('env-guard (RMP Sprint 1 T1.6)', () => {
  it('passes on a clean development env', () => {
    const violations = checkEnvInvariants(baseEnv());
    expect(violations).toEqual([]);
  });

  it('returns no violations when assertEnvInvariants is called on a clean dev env', () => {
    expect(() => assertEnvInvariants(baseEnv())).not.toThrow();
  });

  it('flags an unknown APP_ENV', () => {
    const v = checkEnvInvariants(baseEnv({ APP_ENV: 'wat' }));
    expect(v.some((s) => s.includes('APP_ENV must be one of'))).toBe(true);
  });

  it('flags an empty APP_ENV', () => {
    const env = baseEnv();
    delete (env as Record<string, string>).APP_ENV;
    const v = checkEnvInvariants(env);
    expect(v.some((s) => s.includes('APP_ENV must be one of'))).toBe(true);
  });

  describe('staging / production invariants', () => {
    it('flags ENABLE_TEST_OTP=true in staging', () => {
      const v = checkEnvInvariants(
        baseEnv({ APP_ENV: 'staging', ENABLE_TEST_OTP: 'true' }),
      );
      expect(
        v.some((s) => s.includes('ENABLE_TEST_OTP must NOT be')),
      ).toBe(true);
    });

    it('flags ENABLE_DEV_ADMIN_LOGIN=true in production', () => {
      const v = checkEnvInvariants(
        baseEnv({
          APP_ENV: 'production',
          DATABASE_URL:
            'postgresql://u:p@localhost:5432/db?sslmode=require',
          BACKUP_ENCRYPTION_ENABLED: 'true',
          ENABLE_DEV_ADMIN_LOGIN: 'true',
        }),
      );
      expect(
        v.some((s) => s.includes('ENABLE_DEV_ADMIN_LOGIN must NOT be')),
      ).toBe(true);
    });

    it('flags ENABLE_DEV_TOOLS=1 in production (truthy non-"true")', () => {
      const v = checkEnvInvariants(
        baseEnv({
          APP_ENV: 'production',
          DATABASE_URL:
            'postgresql://u:p@localhost:5432/db?sslmode=require',
          BACKUP_ENCRYPTION_ENABLED: 'true',
          ENABLE_DEV_TOOLS: '1',
        }),
      );
      // The guard's check is case-insensitive against the literal
      // strings 'true' / '1' to keep the dev-bypass class simple.
      // A future tightening could broaden the truthy match.
      expect(
        v.some((s) => s.includes('ENABLE_DEV_TOOLS must NOT be')),
      ).toBe(true);
    });

    it('flags BACKUP_ENCRYPTION_ENABLED != "true" in production', () => {
      const v = checkEnvInvariants(
        baseEnv({
          APP_ENV: 'production',
          DATABASE_URL:
            'postgresql://u:p@localhost:5432/db?sslmode=require',
          BACKUP_ENCRYPTION_ENABLED: 'false',
        }),
      );
      expect(
        v.some((s) => s.includes('BACKUP_ENCRYPTION_ENABLED must be')),
      ).toBe(true);
    });

    it('flags DATABASE_URL without sslmode=require in staging', () => {
      const v = checkEnvInvariants(baseEnv({ APP_ENV: 'staging' }));
      expect(
        v.some((s) => s.includes('DATABASE_URL must include sslmode=require')),
      ).toBe(true);
    });

    it('accepts DATABASE_URL with sslmode=require in staging', () => {
      const v = checkEnvInvariants(
        baseEnv({
          APP_ENV: 'staging',
          DATABASE_URL:
            'postgresql://u:p@localhost:5432/db?sslmode=require',
          BACKUP_ENCRYPTION_ENABLED: 'true',
        }),
      );
      expect(
        v.some((s) => s.includes('DATABASE_URL must include sslmode=require')),
      ).toBe(false);
    });

    it('flags JWT_SECRET shorter than 32 bytes', () => {
      const v = checkEnvInvariants(baseEnv({ JWT_SECRET: 'too-short' }));
      expect(
        v.some((s) => s.includes('JWT_SECRET must be at least 32')),
      ).toBe(true);
    });

    it('flags CRON_SECRET missing entirely', () => {
      const env = baseEnv();
      delete (env as Record<string, string>).CRON_SECRET;
      const v = checkEnvInvariants(env);
      expect(v.some((s) => s.includes('CRON_SECRET is required'))).toBe(true);
    });
  });

  describe('cross-protocol distinctness', () => {
    it('flags JWT_SECRET colliding with FILE_UPLOAD_SECRET', () => {
      const v = checkEnvInvariants(
        baseEnv({
          FILE_UPLOAD_SECRET: STRONG_SECRET_A, // same as JWT_SECRET
        }),
      );
      expect(
        v.some((s) =>
          s.includes('FILE_UPLOAD_SECRET shares identical value with JWT_SECRET'),
        ),
      ).toBe(true);
    });

    it('flags FCM_COMMAND_HMAC_SECRET colliding with SESSION_SECRET', () => {
      const v = checkEnvInvariants(
        baseEnv({
          SESSION_SECRET: STRONG_SECRET_B, // same as FCM_COMMAND_HMAC_SECRET
        }),
      );
      expect(
        v.some((s) =>
          s.includes(
            'FCM_COMMAND_HMAC_SECRET shares identical value with SESSION_SECRET',
          ),
        ),
      ).toBe(true);
    });
  });

  describe('assertEnvInvariants throw behavior', () => {
    it('throws with a single multi-line Error on violation', () => {
      expect(() =>
        assertEnvInvariants(
          baseEnv({
            APP_ENV: 'production',
            DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
            ENABLE_TEST_OTP: 'true',
            BACKUP_ENCRYPTION_ENABLED: 'false',
          }),
        ),
      ).toThrow(/RMP Sprint 1 T1\.6 env-guard/);
    });

    it('throws a multi-violation message that lists every failure', () => {
      try {
        assertEnvInvariants(
          baseEnv({
            APP_ENV: 'production',
            DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
            BACKUP_ENCRYPTION_ENABLED: 'false',
            ENABLE_TEST_OTP: 'true',
            ENABLE_DEV_ADMIN_LOGIN: 'true',
          }),
        );
        // Should not reach here.
        expect(true).toBe(false);
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).toContain('ENABLE_TEST_OTP must NOT be');
        expect(msg).toContain('ENABLE_DEV_ADMIN_LOGIN must NOT be');
        expect(msg).toContain('BACKUP_ENCRYPTION_ENABLED must be');
        expect(msg).toContain('DATABASE_URL must include sslmode=require');
      }
    });
  });

  describe('URL redaction in violation messages', () => {
    it('does not leak the DATABASE_URL password in the violation message', () => {
      try {
        assertEnvInvariants(
          baseEnv({
            APP_ENV: 'production',
            DATABASE_URL:
              'postgresql://voltium_user:hunter2@localhost:5432/db',
            BACKUP_ENCRYPTION_ENABLED: 'false',
          }),
        );
        expect(true).toBe(false);
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).not.toContain('hunter2');
      }
    });
  });
});
