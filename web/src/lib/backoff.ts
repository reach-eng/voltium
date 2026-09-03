/**
 * Exponential Backoff & Retry Safeguard Utility
 *
 * Implements exponential backoff calculation with jitter and strict
 * safeguards against infinite retries.
 */

export const DEFAULT_BASE_BACKOFF_MS = 5_000; // 5 seconds
export const DEFAULT_MAX_BACKOFF_MS = 3_600_000; // 1 hour cap
export const HARD_MAX_RETRY_LIMIT = 10; // Absolute ceiling on retries
export const DEFAULT_MAX_ATTEMPTS = 3;

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  jitter?: boolean;
}

/**
 * Calculates exponential backoff in milliseconds: baseMs * 2^(attempts)
 * Capped at maxMs, with optional jitter to prevent thundering herd.
 */
export function calculateExponentialBackoff(
  attempts: number,
  options: BackoffOptions = {}
): number {
  const baseMs = Math.max(100, options.baseMs ?? DEFAULT_BASE_BACKOFF_MS);
  const maxMs = Math.max(baseMs, options.maxMs ?? DEFAULT_MAX_BACKOFF_MS);
  const safeAttempts = Math.max(0, Math.min(attempts, HARD_MAX_RETRY_LIMIT));

  const exponentialDelay = baseMs * Math.pow(2, safeAttempts);
  const cappedDelay = Math.min(exponentialDelay, maxMs);

  if (options.jitter) {
    // Full jitter between 0.5 * cappedDelay and 1.0 * cappedDelay
    const jitterFactor = 0.5 + Math.random() * 0.5;
    return Math.floor(cappedDelay * jitterFactor);
  }

  return cappedDelay;
}

/**
 * Validates whether the attempt count has exceeded max attempts.
 * Enforces a hard system ceiling of HARD_MAX_RETRY_LIMIT (10).
 */
export function isMaxAttemptsExceeded(
  attempts: number,
  configuredMaxAttempts?: number
): boolean {
  const effectiveMaxAttempts = Math.min(
    Math.max(1, configuredMaxAttempts ?? DEFAULT_MAX_ATTEMPTS),
    HARD_MAX_RETRY_LIMIT
  );
  return attempts >= effectiveMaxAttempts;
}
