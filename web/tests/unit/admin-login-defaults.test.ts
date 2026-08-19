import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAdminLoginDefaults } from '@/lib/admin-login-defaults';

describe('getAdminLoginDefaults (P0-1 / TG-11)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns empty credentials in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getAdminLoginDefaults()).toEqual({ email: '', password: '' });
  });

  it('returns empty credentials in a test environment', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(getAdminLoginDefaults()).toEqual({ email: '', password: '' });
  });

  it('never leaks the default password outside development', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { password, email } = getAdminLoginDefaults();
    expect(password).not.toContain('admin');
    expect(email).not.toContain('voltium');
  });

  it('pre-fills dev credentials only in a development build', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(getAdminLoginDefaults()).toEqual({ email: 'admin@voltium.in', password: 'admin123' });
  });
});
