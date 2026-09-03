import { z } from 'zod';

export const envSchema = z.object({
  // Base
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  FCM_COMMAND_HMAC_SECRET: z
    .string()
    .min(32, 'FCM_COMMAND_HMAC_SECRET must be at least 32 characters'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
  // PR-92 (Backend S2, 2026-08-04): separate HMAC key for file upload
  // tokens. The previous code reused JWT_SECRET across two protocols;
  // rotating JWT_SECRET then invalidates in-flight upload tokens AND
  // discloses the session-signing key to anyone holding a leaked upload
  // token HMAC. FILE_UPLOAD_SECRET is required in production; falls
  // back to JWT_SECRET ONLY in non-prod (dev/test) to keep the local
  // laptop setup friction-free. The runtime env() below rejects the
  // fallback when APP_ENV=production.
  FILE_UPLOAD_SECRET: z.string().min(32, 'FILE_UPLOAD_SECRET must be at least 32 characters').optional(),
  // PR-PICKUP-OTP: dedicated HMAC secret for short-lived verify-phone
  // receipts (issued on successful OTP verification, validated by
  // POST /api/rider/sync/pickup so the emergency-contact gate is not
  // client-only). Mirrors FILE_UPLOAD_SECRET: required in production,
  // falls back to JWT_SECRET in non-prod for laptop-mode ergonomics.
  VERIFY_RECEIPT_SECRET: z.string().min(32, 'VERIFY_RECEIPT_SECRET must be at least 32 characters').optional(),
  // PR-PICKUP-OTP: when true, POST /api/rider/sync/pickup REJECTS a
  // submission with an emergency contact that lacks a valid signed
  // receipt. Default false (backward compatible) until the rider app
  // ships the receipt; flip to true to enforce.
  REQUIRE_EMERGENCY_CONTACT_RECEIPT: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000,http://localhost:8080'),
  TEST_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional(),
  CRON_SECRET_RECONCILIATION: z.string().min(16).optional(),
  CRON_SECRET_CLEANUP_TELEMETRY: z.string().min(16).optional(),
  CRON_SECRET_NOTIFICATIONS: z.string().min(16).optional(),
  CRON_SECRET_ANNOUNCEMENTS: z.string().min(16).optional(),
  WORKER_SECRET: z.string().optional(),
  // PR-152: dedicated secret for /api/internal/debug. Previously
  // the route used CRON_SECRET (same as /api/cron/*), so a leaked
  // cron secret exposed the debug surface too. Now they use
  // distinct secrets.
  DEBUG_SECRET: z.string().optional(),
  // PR-152: internal API base URL used by SSRF-prone routes
  // (workflow-coverage, internal/worker) to call back into our own
  // API. Falls back to NEXT_PUBLIC_APP_URL but operators can override
  // to point at the loopback (e.g. http://127.0.0.1:8081) so the
  // request never leaves the host.
  INTERNAL_API_URL: z.string().url().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:8081'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_FLUTTER_WEB_URL: z.string().url().default('http://localhost:8080'),

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
  DATA_MANAGEMENT_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  BACKUP_ROOT: z.string().optional(),
  BACKUP_SECONDARY_ROOT: z.string().optional(),
  BACKUP_ENCRYPTION_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  MAINTENANCE_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ENABLE_TEST_OTP: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ENABLE_DEV_ADMIN_LOGIN: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  ALLOW_DEV_PII_KEY: z.string().optional(),

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

  // PR-89 (API N6): cap admin wallet-adjust DEBIT amounts and require a
  // second admin to co-approve large debits. Both are INR; the route
  // multiplies by 100 to get paise.
  MAX_ADMIN_DEBIT_INR: z.coerce.number().int().positive().default(50000),
  LARGE_DEBIT_THRESHOLD_INR: z.coerce.number().int().positive().default(10000),
  // AUDIT-RECON 2026-09-02 batch 5 P0-1: per-day aggregate cap on a
  // single admin's DEBITs. The per-call cap + co-approval gate stop
  // any single large debit, but a determined admin can still issue
  // unlimited back-to-back ₹50k debits as long as each is under the
  // per-call cap. The aggregate cap puts a ceiling on cumulative
  // daily drain per admin. Default ₹2,00,000 = 4 max per-call debits
  // + headroom for the co-approved lane.
  MAX_ADMIN_DEBIT_PER_DAY_INR: z.coerce.number().int().positive().default(200000),
  // AUDIT-RECON 2026-09-02 batch 7 P0-1: the outbox queue-lag alerter
  // (see workers/jobs/outbox-queue-lag.job.ts) posts to Slack when the
  // pending+processing count crosses this threshold. Default 50 —
  // matches the manual step in RUNBOOK_OPERATOR_DAY1.md:88.
  OUTBOX_QUEUE_LAG_ALERT_THRESHOLD: z.coerce.number().int().positive().default(50),
}).refine(
  (data) => {
    const isProd = data.APP_ENV === 'production' || data.APP_ENV === 'staging' || data.NODE_ENV === 'production';
    if (isProd && data.ALLOW_DEV_PII_KEY === 'true') {
      return false;
    }
    return true;
  },
  {
    message: 'ALLOW_DEV_PII_KEY=true is strictly forbidden in production and staging environments',
    path: ['ALLOW_DEV_PII_KEY'],
  }
);

if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/voltium-test?schema=public';
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
      NEXT_PUBLIC_FLUTTER_WEB_URL: process.env.NEXT_PUBLIC_FLUTTER_WEB_URL,
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
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid environment variables');
}

const parsedEnv = _env.data;

if (isServer && (parsedEnv.APP_ENV === 'production' || process.env.NODE_ENV === 'production')) {
  if (!process.env.CRON_SECRET) {
    throw new Error(
      'Production architecture violation: CRON_SECRET environment variable is required.'
    );
  }
  if (!process.env.WORKER_SECRET) {
    throw new Error(
      'Production architecture violation: WORKER_SECRET environment variable is required.'
    );
  }

  // P1-8 (2026-08-05 legal/device audit): INTERNAL_API_URL was optional with
  // a silent fallback to NEXT_PUBLIC_APP_URL — the server then health-checked
  // its own public URL through Caddy/TLS. In production it must point at the
  // loopback API (http://127.0.0.1:8081) so internal probes never leave the
  // host. Fail fast at boot so the misconfiguration cannot be shipped.
  if (!parsedEnv.INTERNAL_API_URL) {
    throw new Error(
      'Production architecture violation: INTERNAL_API_URL environment variable is required ' +
      '(set to http://127.0.0.1:8081 so internal health probes stay on the loopback).'
    );
  }

  if (parsedEnv.DATA_MODE !== 'local_laptop') {
    throw new Error('Production architecture violation: DATA_MODE must be local_laptop.');
  }

  if (parsedEnv.STORAGE_PROVIDER !== 'local') {
    throw new Error('Production architecture violation: STORAGE_PROVIDER must be local.');
  }

  const dbHost = new URL(parsedEnv.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(dbHost)) {
    throw new Error(
      'Production architecture violation: DATABASE_URL must point to local PostgreSQL.'
    );
  }

  if (parsedEnv.DIRECT_URL) {
    const directHost = new URL(parsedEnv.DIRECT_URL).hostname;
    if (!['localhost', '127.0.0.1', '::1'].includes(directHost)) {
      throw new Error(
        'Production architecture violation: DIRECT_URL must point to local PostgreSQL.'
      );
    }
  }

  if (parsedEnv.ENABLE_TEST_OTP || parsedEnv.ENABLE_DEV_ADMIN_LOGIN || parsedEnv.TEST_MODE) {
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
      'placeholder',
      'fcm-command-hmac-secret-default-32-chars-long',
    ];
    const secretLower = parsedEnv.JWT_SECRET.toLowerCase();
    if (
      insecurePlaceholders.some((p) => secretLower.includes(p.toLowerCase())) ||
      parsedEnv.JWT_SECRET.length < 32
    ) {
      throw new Error(
        'Security violation: Leaked, insecure, or placeholder JWT_SECRET is not allowed.'
      );
    }
    
    if (
      insecurePlaceholders.some((p) => parsedEnv.FCM_COMMAND_HMAC_SECRET.toLowerCase().includes(p.toLowerCase())) ||
      parsedEnv.FCM_COMMAND_HMAC_SECRET.length < 32
    ) {
      throw new Error(
        'Security violation: Leaked, insecure, or placeholder FCM_COMMAND_HMAC_SECRET is not allowed.'
      );
    }

    // PR-92 (Backend S2): require FILE_UPLOAD_SECRET in production. Falls
    // back to JWT_SECRET only in non-prod (dev/test) for laptop-mode
    // ergonomics. Reusing JWT_SECRET across two protocols makes rotation
    // dangerous and creates a cross-protocol HMAC oracle.
    if (parsedEnv.APP_ENV === 'production' && !parsedEnv.FILE_UPLOAD_SECRET) {
      throw new Error(
        'Security violation: FILE_UPLOAD_SECRET must be set in production. ' +
        'Reusing JWT_SECRET for file upload tokens is not allowed.'
      );
    }

    // PR-PICKUP-OTP: verify-phone receipts are a separate protocol from
    // upload tokens and sessions — reuse would make one leaked HMAC
    // recoverable across all three. Dedicated secret required in prod.
    if (parsedEnv.APP_ENV === 'production' && !parsedEnv.VERIFY_RECEIPT_SECRET) {
      throw new Error(
        'Security violation: VERIFY_RECEIPT_SECRET must be set in production. ' +
        'Reusing JWT_SECRET for verify receipts is not allowed.'
      );
    }

    // PR-PICKUP-OTP (review): fail-closed — production MUST enforce the
    // emergency-contact receipt. If the flag is left unset (default false
    // = "validate-and-ignore"), the OTP gate silently ships OFF despite the
    // secret being present, which would be the exact regression this
    // feature exists to close. Operators flip the flag only after the
    // receipt-capable rider build is installed (old builds 403 otherwise).
    if (
      parsedEnv.APP_ENV === 'production' &&
      !parsedEnv.REQUIRE_EMERGENCY_CONTACT_RECEIPT
    ) {
      throw new Error(
        'Security violation: REQUIRE_EMERGENCY_CONTACT_RECEIPT must be true ' +
        'in production. The pickup emergency-contact OTP gate must be ' +
        'server-enforced once the receipt-capable rider app is deployed.'
      );
    }
  }

  // Prevent dev admin login and test OTP bypasses on staging and production environments
  // Prevent dev admin login and test OTP bypasses on non-development environments
  if (parsedEnv.ENABLE_DEV_ADMIN_LOGIN && parsedEnv.APP_ENV !== 'development') {
    throw new Error(
      'Security violation: ENABLE_DEV_ADMIN_LOGIN must be false on non-development environments.'
    );
  }
  if (parsedEnv.ENABLE_TEST_OTP && parsedEnv.APP_ENV !== 'development') {
    throw new Error(
      'Security violation: ENABLE_TEST_OTP must be false on non-development environments.'
    );
  }
  if (parsedEnv.TEST_MODE && parsedEnv.APP_ENV !== 'development' && parsedEnv.NODE_ENV !== 'test') {
    throw new Error(
      'Security violation: TEST_MODE must be false on staging and production environments.'
    );
  }
}

export const env = parsedEnv;
