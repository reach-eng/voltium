import pino from 'pino';
// W5 / F-087: delegate masking to the canonical pii-redact module. The
// local SENSITIVE_KEYS list had drifted from pii-redact.ts's superset
// (missing keysecret/webhooksecret/merchantid, JWT patterns, hex-token
// patterns, 16-char threshold). One source of truth for what is
// sensitive; pino's log formatter now runs redactPii over every record.
import { redactPii } from './pii-redact';

// PR-112c: APP_ENV-first production gate. The error-context scrubber
// strips 4xx API errors to a minimal shape so we don't log full request
// bodies. APP_ENV=staging is treated as production for this gate
// (staging ships real SMS, real auth, real money flow).
const IS_PRODUCTION_LIKE =
  process.env.APP_ENV === 'production' ||
  process.env.APP_ENV === 'staging' ||
  process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'error' | 'warn' | 'debug';

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    log: (obj) => redactPii(obj) as Record<string, unknown>,
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
