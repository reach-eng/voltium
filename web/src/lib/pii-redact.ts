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
  'newpassword',
  'currentpassword',
  'lockpassword',
  'lockpasswordhash',
  'secret',
  'apikey',
  'apisecret',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'jwt',
  'token',
  'idtoken',
  'authtoken',
  // R10 polish #9 (§4.3): added missing secret keys for payment + crypto
  'keysecret',
  'webhooksecret',
  'merchantid',
  // PII fields
  'otp',
  'aadhaar',
  'aadhaarnumber',
  'pan',
  'pannumber',
  'accountnumber',
  'ifsc',
  'ifsccode',
  'bankaccount',
  'ssn',
  'ein',
  // Contact
  'phone',
  'email',
  // Financial
  'cardnumber',
  'cvv',
  'expiry',
  'pin',
]);

const SENSITIVE_PATTERNS = [
  /^[A-Za-z0-9+/=]{40,}$/, // base64 tokens
  /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWT
  // R10 polish #9 (§4.4): hex strings 32+ chars (128+ bits) are commonly
  // used for API keys, secrets, and tokens. Match lowercase + uppercase.
  /^[0-9a-fA-F]{32,}$/,
];

// R10 polish #9 (§4.7): lowered from 32 to 16 chars. 16 chars catches
// short base64 tokens (e.g. 16-char "abcdefghijklmnop" base64 = 12 bytes)
// that are still secret. False positives are rare in the codebase; if
// any arise, add an explicit allow-list in the caller.
const MIN_PATTERN_LENGTH = 16;

const REDACTED = '[REDACTED]';

/**
 * Redact sensitive fields from a value recursively.
 * Returns a safe-for-logging copy.
 *
 * Handles Error objects by preserving name and message while recursively
 * redacting any other properties (rather than dropping them). The stack
 * trace is intentionally NOT preserved — it may contain local file paths,
 * DB connection strings, or inlined secret material.
 */
export function redactPii<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length >= MIN_PATTERN_LENGTH) {
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(value)) return REDACTED as unknown as T;
      }
    }
    return value;
  }
  if (typeof value !== 'object') return value;

  if (value instanceof Error) {
    // R10 polish #9 (§4.5): previously only preserved name/message/cause.
    // Now we recursively redact ALL other enumerable properties too, so
    // custom error properties (e.g. .code, .errors, .details) are
    // scrubbed rather than silently dropped.
    const safe: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };
    for (const [key, val] of Object.entries(value)) {
      if (key === 'stack') continue; // never preserve stack
      if (key === 'cause') {
        safe.cause = val ? redactPii(val) : val;
        continue;
      }
      safe[key] = redactPii(val as unknown);
    }
    return safe as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item)) as unknown as T;
  }

  const SENSITIVE_KEYS_LIST = Array.from(SENSITIVE_KEYS);
  const redacted: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const normalizedKey = lowerKey.replace(/[-_\s]/g, '');
    const isSensitive =
      SENSITIVE_KEYS.has(lowerKey) ||
      SENSITIVE_KEYS.has(key) ||
      SENSITIVE_KEYS.has(normalizedKey) ||
      SENSITIVE_KEYS_LIST.some((sk) => normalizedKey.includes(sk));
    if (isSensitive) {
      redacted[key] = val !== null && val !== undefined ? REDACTED : val;
    } else if (typeof val === 'object' && val !== null) {
      redacted[key] = redactPii(val);
    } else if (typeof val === 'string' && val.length >= MIN_PATTERN_LENGTH) {
      // R10 polish #9 (§4.4): also check string patterns on nested values, not
      // just top-level. A 32+ char hex string in any field is suspicious
      // and likely a leaked secret.
      let isMatch = false;
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(val)) {
          isMatch = true;
          break;
        }
      }
      redacted[key] = isMatch ? REDACTED : val;
    } else {
      redacted[key] = val;
    }
  }
  return redacted as unknown as T;
}
