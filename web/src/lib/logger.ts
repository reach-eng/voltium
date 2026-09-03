import pino from 'pino';
import { redactPii } from './pii-redact';

// PR-112c: APP_ENV-first production gate. The error-context scrubber
// (lines below) strips 4xx API errors to a minimal shape so we don't
// log full request bodies. APP_ENV=staging is treated as production
// for this gate (staging ships real SMS, real auth, real money flow).
const IS_PRODUCTION_LIKE =
  process.env.APP_ENV === 'production' ||
  process.env.APP_ENV === 'staging' ||
  process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'error' | 'warn' | 'debug';

function sanitizeLogInput(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  return redactPii(input);
}

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    log: (obj) => redactPii(obj) as Record<string, unknown>,
  },
});

export const logger = {
  info(message: string, context?: unknown): void {
    const safeContext = (sanitizeLogInput(context) as object) || {};
    pinoInstance.info(safeContext, (redactPii(message) as string) || message);
  },
  error(message: string, context?: unknown): void {
    const safeContext = sanitizeLogInput(context);
    if (IS_PRODUCTION_LIKE && safeContext && typeof safeContext === 'object') {
      const err = safeContext as any;
      if (err.isApiError && err.statusCode >= 400 && err.statusCode < 500) {
        pinoInstance.error(
          { code: err.code, message: err.message, status: err.statusCode },
          (redactPii(message) as string) || message
        );
        return;
      }
    }
    pinoInstance.error((safeContext as object) || {}, (redactPii(message) as string) || message);
  },
  warn(message: string, context?: unknown): void {
    const safeContext = (sanitizeLogInput(context) as object) || {};
    pinoInstance.warn(safeContext, (redactPii(message) as string) || message);
  },
  debug(message: string, context?: unknown): void {
    const safeContext = (sanitizeLogInput(context) as object) || {};
    pinoInstance.debug(safeContext, (redactPii(message) as string) || message);
  },
};
