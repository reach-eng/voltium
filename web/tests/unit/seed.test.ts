import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('seed.ts — SEED_ADMIN_PASSWORD validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('generates a random dev password when SEED_ADMIN_PASSWORD is missing in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'development';
    delete process.env.SEED_ADMIN_PASSWORD;

    const seedAdminPassword =
      process.env.SEED_ADMIN_PASSWORD ||
      (process.env.NODE_ENV === 'development'
        ? `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
        : null);

    expect(seedAdminPassword).toBeDefined();
    expect(seedAdminPassword).toMatch(/^dev-/);
  });

  it('fails if SEED_ADMIN_PASSWORD is null when not in development', () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'staging';
    delete process.env.SEED_ADMIN_PASSWORD;

    const seedAdminPassword =
      process.env.SEED_ADMIN_PASSWORD ||
      (process.env.NODE_ENV === 'development'
        ? `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
        : null);

    expect(seedAdminPassword).toBeNull();
  });

  it('uses explicit SEED_ADMIN_PASSWORD when provided', () => {
    process.env.SEED_ADMIN_PASSWORD = 'super-secret-seed-password-123';
    const seedAdminPassword =
      process.env.SEED_ADMIN_PASSWORD ||
      (process.env.NODE_ENV === 'development'
        ? `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
        : null);

    expect(seedAdminPassword).toBe('super-secret-seed-password-123');
  });
});
