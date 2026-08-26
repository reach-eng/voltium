/**
 * RMP Sprint 1 T1.6 (2026-08-27) — startup env-guard.
 *
 * Purpose: refuse to boot the Voltium web app in any non-development
 * environment if any of the "blast-radius" production invariants is
 * violated. The lighter Zod-based validation in `web/src/lib/env.ts`
 * already catches missing / wrong-type variables; this guard is a
 * fail-closed second line of defense for the specific subset of
 * invariants the master plan calls out as P0 release blockers:
 *
 *   1. APP_ENV must be one of {development, test, staging, production}.
 *   2. In any non-development environment, EVERY one of these must be
 *      strictly 'false' (the dev-bypass class):
 *        - ENABLE_TEST_OTP
 *        - ENABLE_DEV_ADMIN_LOGIN
 *        - TEST_MODE
 *        - ENABLE_DEV_TOOLS
 *   3. JWT_SECRET length >= 32 bytes.
 *   4. BACKUP_ENCRYPTION_ENABLED === 'true' (any non-dev env).
 *   5. DATABASE_URL must include `sslmode=require` (any non-dev env).
 *   6. The other required secrets (FCM_COMMAND_HMAC_SECRET,
 *      CRON_SECRET, WORKER_SECRET) must be present and >= 32 bytes.
 *   7. JWT_SECRET must not collide with FILE_UPLOAD_SECRET, with
 *      FCM_COMMAND_HMAC_SECRET, or with SESSION_SECRET (cross-protocol
 *      HMAC oracle mitigation, the spirit of the prior PR-92 fix).
 *
 * The guard is invoked once, at server startup, BEFORE any request is
 * served. Failure throws and prevents the process from binding. There
 * is NO override flag — the only way to bypass is to set APP_ENV to
 * 'development' (which is the dev / laptop-mode case where the dev
 * bypasses are legitimate).
 *
 * The function is pure: it takes a snapshot of process.env and
 * returns an array of human-readable violations (empty on success).
 * The caller decides how to handle the failure (throw, log+exit, etc.).
 *
 * @see docs/SECRET_ROTATION_INVENTORY.md
 * @see docs/ADR/ADR-001-pii-encryption.md
 */

export interface EnvGuardOptions {
  /**
   * The list of dev-bypass flag names. Each must be strictly
   * non-'true' in any non-development environment.
   */
  devBypassFlagNames?: readonly string[];

  /**
   * Required secret names. Each must be present and >= 32 chars in
   * any environment (development included).
   */
  requiredSecretNames?: readonly string[];

  /**
   * Secret names whose values must NOT collide with each other
   * (cross-protocol HMAC oracle prevention).
   */
  mutuallyDistinctSecretNames?: readonly string[];
}

const DEFAULT_DEV_BYPASS_FLAGS = [
  'ENABLE_TEST_OTP',
  'ENABLE_DEV_ADMIN_LOGIN',
  'TEST_MODE',
  'ENABLE_DEV_TOOLS',
] as const;

const DEFAULT_REQUIRED_SECRETS = [
  'JWT_SECRET',
  'FCM_COMMAND_HMAC_SECRET',
  'CRON_SECRET',
  'WORKER_SECRET',
] as const;

const DEFAULT_MUTUALLY_DISTINCT_SECRETS = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'FILE_UPLOAD_SECRET',
  'FCM_COMMAND_HMAC_SECRET',
] as const;

const MIN_SECRET_LENGTH = 32;
const NON_DEV_ENVS = new Set(['test', 'staging', 'production']);

/**
 * Returns the list of human-readable invariant violations; empty on
 * success. Pure function (no I/O, no side effects).
 */
export function checkEnvInvariants(
  env: NodeJS.ProcessEnv = process.env,
  options: EnvGuardOptions = {}
): string[] {
  const {
    devBypassFlagNames = DEFAULT_DEV_BYPASS_FLAGS,
    requiredSecretNames = DEFAULT_REQUIRED_SECRETS,
    mutuallyDistinctSecretNames = DEFAULT_MUTUALLY_DISTINCT_SECRETS,
  } = options;

  const violations: string[] = [];

  const appEnv = String(env.APP_ENV ?? '').toLowerCase();
  if (!['development', 'test', 'staging', 'production'].includes(appEnv)) {
    violations.push(
      `APP_ENV must be one of development|test|staging|production, got "${env.APP_ENV ?? '<unset>'}"`,
    );
    // Without a known APP_ENV we cannot apply the non-dev rules; the
    // required-secret checks below still apply, but the SSL / dev-
    // bypass checks do not.
    return violations.concat(
      requireSecretLengthViolations(env, requiredSecretNames),
      distinctnessViolations(env, mutuallyDistinctSecretNames),
    );
  }

  if (NON_DEV_ENVS.has(appEnv)) {
    // (2) dev-bypass flags must be strictly non-'true'.
    for (const flag of devBypassFlagNames) {
      const value = String(env[flag] ?? '').toLowerCase();
      if (value === 'true' || value === '1') {
        violations.push(
          `${flag} must NOT be 'true' in APP_ENV=${appEnv} (env-guard refuses dev bypasses in non-dev environments)`,
        );
      }
    }

    // (4) BACKUP_ENCRYPTION_ENABLED must be 'true'.
    if (String(env.BACKUP_ENCRYPTION_ENABLED ?? '').toLowerCase() !== 'true') {
      violations.push(
        `BACKUP_ENCRYPTION_ENABLED must be 'true' in APP_ENV=${appEnv} (env-guard refuses to boot without encrypted backups)`,
      );
    }

    // (5) DATABASE_URL must include sslmode=require.
    const dbUrl = String(env.DATABASE_URL ?? '');
    if (!dbUrl) {
      violations.push(
        `DATABASE_URL is required in APP_ENV=${appEnv}`,
      );
    } else if (!/[?&]sslmode=require(?:&|$)/.test(dbUrl)) {
      violations.push(
        `DATABASE_URL must include sslmode=require in APP_ENV=${appEnv} (got: ${redactUrl(dbUrl)})`,
      );
    }
  }

  // (3) and (6): required secrets must be present and >= 32 bytes in
  // EVERY environment.
  violations.push(...requireSecretLengthViolations(env, requiredSecretNames));

  // (7): distinctness across cross-protocol HMAC secrets.
  violations.push(...distinctnessViolations(env, mutuallyDistinctSecretNames));

  return violations;
}

function requireSecretLengthViolations(
  env: NodeJS.ProcessEnv,
  names: readonly string[]
): string[] {
  const violations: string[] = [];
  for (const name of names) {
    const value = String(env[name] ?? '');
    if (!value) {
      violations.push(`${name} is required`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      violations.push(
        `${name} must be at least ${MIN_SECRET_LENGTH} characters (got ${value.length})`,
      );
    }
  }
  return violations;
}

function distinctnessViolations(
  env: NodeJS.ProcessEnv,
  names: readonly string[]
): string[] {
  const violations: string[] = [];
  const seen = new Map<string, string>();
  for (const name of names) {
    const value = env[name];
    if (!value) continue; // missing-secret violation handled elsewhere
    const previous = seen.get(value);
    if (previous) {
      violations.push(
        `${name} shares identical value with ${previous} (cross-protocol HMAC oracle risk; rotate at least one of them)`,
      );
    } else {
      seen.set(value, name);
    }
  }
  return violations;
}

/**
 * Strip the user:password component of a database URL before logging
 * (defense in depth — the env-guard violation messages are surfaced
 * to the operator's terminal, not the application log).
 */
function redactUrl(url: string): string {
  try {
    // Use the WHATWG URL API; new URL() throws on non-URL input.
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '<unparseable DATABASE_URL>';
  }
}

/**
 * Convenience: assert that checkEnvInvariants passes, throwing with
 * a single human-readable error message if not. Call from the server
 * entry point (instrumentation.ts) before any request is served.
 *
 * Throws a plain Error (not a custom class) so a misconfigured
 * production boot fails loudly without depending on anything else
 * being importable at that moment.
 */
export function assertEnvInvariants(
  env: NodeJS.ProcessEnv = process.env,
  options: EnvGuardOptions = {}
): void {
  const violations = checkEnvInvariants(env, options);
  if (violations.length === 0) return;
  const header =
    'RMP Sprint 1 T1.6 env-guard: refusing to boot the application.';
  const body = violations.map((v) => `  - ${v}`).join('\n');
  throw new Error(`${header}\n${body}`);
}
