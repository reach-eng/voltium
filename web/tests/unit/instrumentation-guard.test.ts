import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// P2-4: instrumentation.ts must refuse to boot when ENABLE_DEV_ADMIN_LOGIN is
// set in a production environment. The auto-login route was deleted (P0-2), so
// the flag is dead config — but a stale env-file mistake must fail fast.
// ---------------------------------------------------------------------------

describe('instrumentation register() — P2-4 production guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when APP_ENV=production and ENABLE_DEV_ADMIN_LOGIN=true', async () => {
    process.env.APP_ENV = 'production';
    process.env.ENABLE_DEV_ADMIN_LOGIN = 'true';

    const { register } = await import('../../instrumentation');
    await expect(register()).rejects.toThrow(/ENABLE_DEV_ADMIN_LOGIN/);
  });

  it('does not throw when ENABLE_DEV_ADMIN_LOGIN is unset in production', async () => {
    process.env.APP_ENV = 'production';
    delete process.env.ENABLE_DEV_ADMIN_LOGIN;

    const { register } = await import('../../instrumentation');
    // NEXT_RUNTIME is unset in the test env, so register() returns after the
    // guard without initializing the (heavy) OpenTelemetry SDK.
    await expect(register()).resolves.toBeUndefined();
  });

  it('does not throw when the flag is set in a non-production env (dev laptop)', async () => {
    process.env.APP_ENV = 'development';
    process.env.ENABLE_DEV_ADMIN_LOGIN = 'true';

    const { register } = await import('../../instrumentation');
    await expect(register()).resolves.toBeUndefined();
  });
});
