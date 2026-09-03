import { describe, it, expect } from 'vitest';
import { envSchema } from '@/lib/env';

describe('Backup Encryption Enabled by Default', () => {
  it('defaults BACKUP_ENCRYPTION_ENABLED to true when omitted from environment', () => {
    const minimalEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'super-secret-jwt-key-32-chars-long-test',
      FCM_COMMAND_HMAC_SECRET: 'fcm-command-hmac-secret-default-32-chars-long',
    };

    const parsed = envSchema.parse(minimalEnv);
    expect(parsed.BACKUP_ENCRYPTION_ENABLED).toBe(true);
  });

  it('allows explicit override to false when specifically configured', () => {
    const customEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'super-secret-jwt-key-32-chars-long-test',
      FCM_COMMAND_HMAC_SECRET: 'fcm-command-hmac-secret-default-32-chars-long',
      BACKUP_ENCRYPTION_ENABLED: 'false',
    };

    const parsed = envSchema.parse(customEnv);
    expect(parsed.BACKUP_ENCRYPTION_ENABLED).toBe(false);
  });
});
