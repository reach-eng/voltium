import pino from 'pino';

// PR-112c: APP_ENV-first production gate. The error-context scrubber
// (lines below) strips 4xx API errors to a minimal shape so we don't
// log full request bodies. APP_ENV=staging is treated as production
// for this gate (staging ships real SMS, real auth, real money flow).
const IS_PRODUCTION_LIKE =
  process.env.APP_ENV === 'production' ||
  process.env.APP_ENV === 'staging' ||
  process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'error' | 'warn' | 'debug';

const SENSITIVE_KEYS = [
  'aadhaar',
  'aadhaarNumber',
  'pan',
  'panNumber',
  'phone',
  'email',
  'accountNumber',
  'ifscCode',
  'password',
  'token',
  'otp',
];
const LOWER_SENSITIVE_KEYS = SENSITIVE_KEYS.map((s) => s.toLowerCase());

function maskSensitiveData(obj: unknown, seen?: WeakSet<object>): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (seen?.has(obj)) return '[Circular]';
  const seenSet = seen || new WeakSet<object>();
  seenSet.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item, seenSet));
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (LOWER_SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      if (typeof value === 'string') {
        masked[key] = value.length > 4 ? `****${value.slice(-4)}` : '****';
      } else {
        masked[key] = '****';
      }
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, seenSet);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    log: (obj) => maskSensitiveData(obj) as Record<string, unknown>,
  },
});

export const logger = {
  info(message: string, context?: unknown): void {
    pinoInstance.info(context || {}, message);
  },
  error(message: string, context?: unknown): void {
    if (IS_PRODUCTION_LIKE && context && typeof context === 'object') {
      const err = context as any;
      if (err.isApiError && err.statusCode >= 400 && err.statusCode < 500) {
        pinoInstance.error({ code: err.code, message: err.message, status: err.statusCode }, message);
        return;
      }
    }
    pinoInstance.error((context as object) || {}, message);
  },
  warn(message: string, context?: unknown): void {
    pinoInstance.warn(context || {}, message);
  },
  debug(message: string, context?: unknown): void {
    pinoInstance.debug(context || {}, message);
  },
};
