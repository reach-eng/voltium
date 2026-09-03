/**
 * PR-92 (Backend S2, 2026-08-04): upload tokens must use a dedicated
 * FILE_UPLOAD_SECRET, not the JWT signing key. This test verifies
 * that:
 *   1. With FILE_UPLOAD_SECRET set, tokens are signed with THAT key
 *      (not JWT_SECRET).
 *   2. A token signed with JWT_SECRET alone is rejected when
 *      FILE_UPLOAD_SECRET is set.
 *   3. In non-production (dev/test), the fallback to JWT_SECRET
 *      still works.
 *
 * The test manipulates process.env before importing the modules, so
 * it uses dynamic `import()` after `vi.resetModules()`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'crypto';

describe('file upload token HMAC key (PR-92 / Backend S2)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('signs upload tokens with FILE_UPLOAD_SECRET when set, not JWT_SECRET', async () => {
    process.env.FILE_UPLOAD_SECRET =
      'a-different-upload-secret-key-also-32-chars-or-more';
    process.env.APP_ENV = 'production';
    process.env.JWT_SECRET =
      'a-jwt-secret-key-at-least-thirty-two-characters-long';
    process.env.FCM_COMMAND_HMAC_SECRET =
      'a-fcm-secret-key-at-least-thirty-two-characters-long';
    // Required because the env() guard refuses production with
    // ALLOW_DEV_PII_KEY=true, ENABLE_TEST_OTP, or ENABLE_DEV_ADMIN_LOGIN.
    process.env.ALLOW_DEV_PII_KEY = 'false';
    process.env.ENABLE_TEST_OTP = 'false';
    process.env.ENABLE_DEV_ADMIN_LOGIN = 'false';
    process.env.TEST_MODE = 'false';
    // P1-8 (2026-08-05 legal/device audit): INTERNAL_API_URL is now
    // hard-required in production — the prod env simulation must set it.
    process.env.INTERNAL_API_URL = 'http://127.0.0.1:8081';

    const { env } = await import('@/lib/env');
    expect(env.FILE_UPLOAD_SECRET).toBe(
      'a-different-upload-secret-key-also-32-chars-or-more'
    );

    // Two tokens for the same fileRecordId, one signed with each key.
    const fileRecordId = 'rec_abc';
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const payload = `${fileRecordId}:${expiresAt}`;
    const tokenUpload = `${expiresAt}.${createHmac('sha256', env.FILE_UPLOAD_SECRET!).update(payload).digest('hex')}`;
    const tokenJwt = `${expiresAt}.${createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex')}`;

    // Load the use-cases fresh so they read the new env.
    const { fileUseCases } = await import(
      '@/server/modules/files/files.use-cases'
    );

    // The token signed with FILE_UPLOAD_SECRET must verify.
    expect(fileUseCases._verifyUploadToken(fileRecordId, tokenUpload)).toBe(true);
    // The token signed with JWT_SECRET must NOT verify.
    expect(fileUseCases._verifyUploadToken(fileRecordId, tokenJwt)).toBe(false);
  });

  it('falls back to JWT_SECRET in non-prod when FILE_UPLOAD_SECRET is unset', async () => {
    delete process.env.FILE_UPLOAD_SECRET;
    process.env.APP_ENV = 'development';
    process.env.JWT_SECRET =
      'a-jwt-secret-key-at-least-thirty-two-characters-long';
    process.env.FCM_COMMAND_HMAC_SECRET =
      'a-fcm-secret-key-at-least-thirty-two-characters-long';

    const { env } = await import('@/lib/env');
    expect(env.FILE_UPLOAD_SECRET).toBeUndefined();
    expect(env.APP_ENV).toBe('development');

    // With no FILE_UPLOAD_SECRET in dev, the use-case must use JWT_SECRET.
    const fileRecordId = 'rec_dev';
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const payload = `${fileRecordId}:${expiresAt}`;
    const token = `${expiresAt}.${createHmac('sha256', env.JWT_SECRET).update(payload).digest('hex')}`;

    const { fileUseCases } = await import(
      '@/server/modules/files/files.use-cases'
    );
    expect(fileUseCases._verifyUploadToken(fileRecordId, token)).toBe(true);
  });
});
