/**
 * Runtime guard: SESSION_SECRET must be set and at least 32 characters.
 * The Zod schema in env.ts already validates this, but this guard provides
 * an extra fail-fast check if env.ts is ever bypassed or overridden.
 *
 * Runs at module-load time on the server only.
 */
if (typeof window === 'undefined') {
  const _secret = process.env.SESSION_SECRET;
  if (!_secret || _secret.length < 32) {
    throw new Error(
      '[Voltium] SESSION_SECRET must be set to a string of at least 32 characters. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
}

export const APP_CONFIG = Object.freeze({
  // Splash screen animation
  SPLASH_PROGRESS_INTERVAL_MS: 40,
  SPLASH_AUTO_NAVIGATE_DELAY_MS: 2500,

  // React Query defaults
  QUERY_STALE_TIME_MS: 30 * 1000,
  QUERY_GC_TIME_MS: 5 * 60 * 1000,

  // Session
  SESSION_MAX_AGE_SECONDS: 60 * 60 * 24 * 7, // 7 days

  // Animation
  MOTION_TRANSITION_DURATION: 0.25,

  // API
  API_RATE_LIMIT_WINDOW_MS: 60 * 1000,
  API_RATE_LIMIT_MAX_REQUESTS: 60,

  // UI
  MAX_TOP_UP_AMOUNT: 50000,
  DAILY_TOP_UP_LIMIT: 100000,
} as const);
