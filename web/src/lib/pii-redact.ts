/**
 * PII Redaction Utility
 *
 * Strips personally identifiable information and secrets from objects
 * before they reach logs, error handlers, or any output channel.
 *
 * Use this in catch blocks and logger calls to prevent credential leaks.
 */

const SENSITIVE_KEYS = new Set([
  // Passwords & secrets
  'password',
  'newPassword',
  'currentPassword',
  'lockPassword',
  'secret',
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'jwt',
  'token',
  'idToken',
  'authToken',
  // PII fields
  'otp',
  'aadhaar',
  'aadhaarNumber',
  'pan',
  'panNumber',
  'accountNumber',
  'ifsc',
  'ifscCode',
  'bankAccount',
  'ssn',
  'ein',
  // Contact
  'phone',
  'email',
  // Financial
  'cardNumber',
  'cvv',
  'expiry',
  'pin',
]);

const SENSITIVE_PATTERNS = [
  /^[A-Za-z0-9+/=]{40,}$/, // base64 tokens
  /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWT
];

const REDACTED = '[REDACTED]';

/**
 * Redact sensitive fields from a value recursively.
 * Returns a safe-for-logging copy.
 *
 * Handles Error objects by preserving name and message while stripping
 * stack traces and any sensitive keys on the error.
 */
export function redactPii<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 32) {
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(value)) return REDACTED as unknown as T;
      }
    }
    return value;
  }
  if (typeof value !== 'object') return value;

  if (value instanceof Error) {
    const safe: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };
    if ('cause' in value && value.cause) {
      safe.cause = redactPii(value.cause);
    }
    return safe as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item)) as unknown as T;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key)) {
      redacted[key] = val !== null && val !== undefined ? REDACTED : val;
    } else if (typeof val === 'object') {
      redacted[key] = redactPii(val);
    } else {
      redacted[key] = val;
    }
  }
  return redacted as unknown as T;
}
