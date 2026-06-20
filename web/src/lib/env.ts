import { z } from 'zod';

const envSchema = z.object({
  // Base
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  FCM_COMMAND_HMAC_SECRET: z.string().min(32, 'FCM_COMMAND_HMAC_SECRET must be at least 32 characters').default('fcm-command-hmac-secret-default-32-chars-long'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000'),
  CRON_SECRET: z.string().optional(),
  WORKER_SECRET: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:8081'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),

  // Integrations
  SMS_PROVIDER: z.enum(['mock', 'msg91']).default('mock'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),

  // Data mode — 'default' (any) or 'local_laptop' (all data stays on laptop)
  DATA_MODE: z.enum(['default', 'local_laptop']).default('default'),

  // Storage — local only
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  LOCAL_STORAGE_ROOT: z.string().optional(),

  // Data Management (laptop/local mode)
  DATA_MANAGEMENT_ENABLED: z.string().default('false').transform(v => v === 'true'),
  BACKUP_ROOT: z.string().optional(),
  BACKUP_SECONDARY_ROOT: z.string().optional(),
  BACKUP_ENCRYPTION_ENABLED: z.string().default('false').transform(v => v === 'true'),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  MAINTENANCE_MODE: z.string().default('false').transform(v => v === 'true'),
  ENABLE_TEST_OTP: z.string().default('false').transform(v => v === 'true'),
  ENABLE_DEV_ADMIN_LOGIN: z.string().default('false').transform(v => v === 'true'),

  // Features
  NEXT_PUBLIC_ENABLE_KYC: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  NEXT_PUBLIC_ENABLE_GUARANTOR: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  NEXT_PUBLIC_ENABLE_REWARDS: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  NEXT_PUBLIC_ENABLE_REFERRAL: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/voltium-test?schema=public';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'voltium-dev-secret-key-INSECURE-DO-NOT-PROD-32-CHARS';
}

const isServer = typeof window === 'undefined';

const parseTarget = isServer
  ? process.env
  : {
      NODE_ENV: process.env.NODE_ENV,
      APP_ENV: process.env.APP_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
      NEXT_PUBLIC_ENABLE_KYC: process.env.NEXT_PUBLIC_ENABLE_KYC,
      NEXT_PUBLIC_ENABLE_GUARANTOR: process.env.NEXT_PUBLIC_ENABLE_GUARANTOR,
      NEXT_PUBLIC_ENABLE_REWARDS: process.env.NEXT_PUBLIC_ENABLE_REWARDS,
      NEXT_PUBLIC_ENABLE_REFERRAL: process.env.NEXT_PUBLIC_ENABLE_REFERRAL,
      DATABASE_URL: 'http://localhost',
      JWT_SECRET: 'dummy-secret-key-for-client-side-bundle-validation-32-chars',
      SESSION_SECRET: 'dummy-session-secret-for-client-side-bundle-validation-32-chars',
      DIRECT_URL: 'http://localhost',
      STORAGE_PROVIDER: 'local',
    };

// Validate target
const _env = envSchema.safeParse(parseTarget);

if (!_env.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid environment variables');
}

const parsedEnv = _env.data;

if (isServer && (parsedEnv.APP_ENV === 'production' || process.env.NODE_ENV === 'production')) {
  if (process.env.DATABASE_OFFLINE === 'true') {
    throw new Error('Production architecture violation: DATABASE_OFFLINE mock fallback is not allowed in production.');
  }

  if (!process.env.CRON_SECRET) {
    throw new Error('Production architecture violation: CRON_SECRET environment variable is required.');
  }
  if (!process.env.WORKER_SECRET) {
    throw new Error('Production architecture violation: WORKER_SECRET environment variable is required.');
  }

  if (parsedEnv.DATA_MODE !== 'local_laptop') {
    throw new Error('Production architecture violation: DATA_MODE must be local_laptop.');
  }

  if (parsedEnv.STORAGE_PROVIDER !== 'local') {
    throw new Error('Production architecture violation: STORAGE_PROVIDER must be local.');
  }

  const dbHost = new URL(parsedEnv.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(dbHost)) {
    throw new Error('Production architecture violation: DATABASE_URL must point to local PostgreSQL.');
  }

  if (parsedEnv.DIRECT_URL) {
    const directHost = new URL(parsedEnv.DIRECT_URL).hostname;
    if (!['localhost', '127.0.0.1', '::1'].includes(directHost)) {
      throw new Error('Production architecture violation: DIRECT_URL must point to local PostgreSQL.');
    }
  }

  if (parsedEnv.ENABLE_TEST_OTP || parsedEnv.ENABLE_DEV_ADMIN_LOGIN) {
    throw new Error('Production architecture violation: dev OTP/admin bypass flags must be false.');
  }
}

if (isServer) {
  // Verify JWT_SECRET is secure and not a placeholder or known leaked key (allowed only in test mode)
  if (parsedEnv.NODE_ENV !== 'test') {
    const insecurePlaceholders = [
      'voltium-dev-secret-key-INSECURE-DO-NOT-PROD-32-CHARS',
      'YOUR_SECURE_JWT_SECRET',
      'YOUR_SECURE_JWT_SECRET_MIN_32_CHARS_LONG',
      'placeholder'
    ];
    const secretLower = parsedEnv.JWT_SECRET.toLowerCase();
    if (
      insecurePlaceholders.some(p => secretLower.includes(p.toLowerCase())) ||
      parsedEnv.JWT_SECRET.length < 32
    ) {
      throw new Error('Security violation: Leaked, insecure, or placeholder JWT_SECRET is not allowed.');
    }
  }

  // Prevent dev admin login and test OTP bypasses on staging and production environments
  // Prevent dev admin login and test OTP bypasses on non-development environments
  if (parsedEnv.ENABLE_DEV_ADMIN_LOGIN && parsedEnv.APP_ENV !== 'development') {
    throw new Error('Security violation: ENABLE_DEV_ADMIN_LOGIN must be false on non-development environments.');
  }
  if (parsedEnv.ENABLE_TEST_OTP && parsedEnv.APP_ENV !== 'development') {
    throw new Error('Security violation: ENABLE_TEST_OTP must be false on non-development environments.');
  }
}

export const env = parsedEnv;
