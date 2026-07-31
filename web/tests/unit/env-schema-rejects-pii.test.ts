import { describe, it, expect, beforeEach } from 'vitest';
import { envSchema } from '@/lib/env';

describe('env schema — ALLOW_DEV_PII_KEY rejection in production', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects ALLOW_DEV_PII_KEY=true in production environment', () => {
    const testEnv = {
      ...process.env,
      NODE_ENV: 'production',
      APP_ENV: 'production',
      ALLOW_DEV_PII_KEY: 'true',
    };

    const result = envSchema.safeParse(testEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errStr = JSON.stringify(result.error.issues);
      expect(errStr).toContain('ALLOW_DEV_PII_KEY');
    }
  });
});
