/**
 * Device-route policy helpers.
 *
 * The rider app hits `/api/device/data` and `/api/device/permissions` to
 * sync device state (location, contacts, etc.) to the server. In production
 * and staging the rider identity must come from the authenticated session —
 * trusting a body-supplied `riderId` in those environments would let any
 * caller (or worse, a compromised client) impersonate another rider.
 *
 * The dev/test bypass is only safe when the server is running in dev or
 * test mode (and only used by the integration test harness, never by real
 * clients). Without this guard, a misconfigured prod with
 * `APP_ENV='staging'` would silently let the body in.
 *
 * The two device routes were originally inconsistent on this guard (only
 * one checked staging explicitly). This module is the single source of truth.
 *
 * Implementation note: we read process.env directly here, not the cached
 * `env` object from `env.ts`. The `env` module is computed at import time
 * and is frozen; the test harness (and the E2E runner) sets
 * `process.env.APP_ENV` at runtime, and the device-policy checks have to
 * reflect that. The dev/test guards here are simple string comparisons
 * and are safe to read on every call.
 */

function isProdOrStagingEnv(): boolean {
  return (
    process.env.APP_ENV === 'production' ||
    process.env.APP_ENV === 'staging' ||
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Returns true when body-supplied rider identity is allowed by policy.
 *
 * Two allow-cases, both keyed on `APP_ENV`:
 *
 *  1. **Local dev:** `APP_ENV=development` (and `NODE_ENV != production` as
 *     defense). The laptop dev workflow.
 *
 *  2. **E2E test harness:** `TEST_MODE=true` AND `NODE_ENV=development`.
 *     The Flutter integration tests set these (see
 *     `flutter/integration_test/e2e_individual/run_phased_tests.sh:121`).
 *     CI typically also sets `APP_ENV=production`, but `TEST_MODE=true` is
 *     the controlled-env signal we trust.
 *
 * Hard deny: any of `APP_ENV=production`, `APP_ENV=staging`, or
 * `NODE_ENV=production` (without an explicit test harness signal) is
 * denied. The §1.2 bug was that one route allowed the bypass on staging
 * while the other didn't; this rule is the same for both.
 */
export function isDeviceSeedAllowed(): boolean {
  // Hard deny: any production-adjacent APP_ENV wins, regardless of
  // TEST_MODE. This is the §1.2 fix.
  if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging') {
    return false;
  }
  // Hard deny: NODE_ENV=production (real prod runner) without an explicit
  // test harness signal.
  if (
    process.env.NODE_ENV === 'production' &&
    !(process.env.TEST_MODE === 'true' && process.env.APP_ENV === undefined)
  ) {
    return false;
  }
  // Allow case 1: local dev
  if (process.env.APP_ENV === 'development') {
    return true;
  }
  // Allow case 2: E2E test harness
  if (
    process.env.TEST_MODE === 'true' &&
    process.env.NODE_ENV === 'development'
  ) {
    return true;
  }
  return false;
}

/**
 * Returns true when the current process is production-adjacent. Used by
 * callers that need to refuse dev/test fallbacks (audit log writes, PII
 * encryption, etc.).
 */
export function isProdOrStaging(): boolean {
  return isProdOrStagingEnv();
}
