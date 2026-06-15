import { z } from 'zod';

const envSchema = z.object({
  // Base
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().url(),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:8081'),

  // Integrations
  SMS_PROVIDER: z.enum(['mock', 'msg91']).default('mock'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),

  // Data mode — 'default' (any) or 'local_laptop' (all data stays on laptop)
  DATA_MODE: z.enum(['default', 'local_laptop']).default('default'),

  // Storage — local only
  LOCAL_STORAGE_ROOT: z.string().optional(),

  // Data Management (laptop/local mode)
  DATA_MANAGEMENT_ENABLED: z.string().default('false').transform(v => v === 'true'),
  BACKUP_ROOT: z.string().optional(),
  BACKUP_SECONDARY_ROOT: z.string().optional(),
  BACKUP_ENCRYPTION_ENABLED: z.string().default('false').transform(v => v === 'true'),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  MAINTENANCE_MODE: z.string().default('false').transform(v => v === 'true'),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),

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
      NEXT_PUBLIC_ENABLE_KYC: process.env.NEXT_PUBLIC_ENABLE_KYC,
      NEXT_PUBLIC_ENABLE_GUARANTOR: process.env.NEXT_PUBLIC_ENABLE_GUARANTOR,
      NEXT_PUBLIC_ENABLE_REWARDS: process.env.NEXT_PUBLIC_ENABLE_REWARDS,
      NEXT_PUBLIC_ENABLE_REFERRAL: process.env.NEXT_PUBLIC_ENABLE_REFERRAL,
      DATABASE_URL: 'http://localhost',
      JWT_SECRET: 'dummy-secret-key-for-client-side-bundle-validation-32-chars',
    };

// Validate target
const _env = envSchema.safeParse(parseTarget);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
