/**
 * Ryd Error Monitoring
 *
 * Production: Set SENTRY_DSN in .env to enable Sentry.
 * Development: Errors are logged to console only (no DSN needed).
 */

import { env } from '@/lib/env';

type ErrorContext = {
  userId?: string;
  userRole?: string;
  route?: string;
  additional?: Record<string, unknown>;
};

// Lazy-loaded Sentry — only initialized when DSN is available
let sentryInitPromise: Promise<any> | null = null;

async function getSentry() {
  if (sentryInitPromise) return sentryInitPromise;

  sentryInitPromise = (async () => {
    const dsn = env.SENTRY_DSN;
    if (!dsn) {
      return null;
    }
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn,
        environment: env.APP_ENV,
        release: env.NEXT_PUBLIC_APP_URL,
        tracesSampleRate: env.APP_ENV === 'development' ? 1.0 : 0.1,
        maxValueLength: 10000,
      });
      sentryInitPromise = Promise.resolve(Sentry);
      return Sentry;
    } catch {
      console.warn('[monitoring] Sentry SDK not available, falling back to console logging');
      return null;
    }
  })();

  return sentryInitPromise;
}

/**
 * Capture an error and send to Sentry (if configured).
 * Always logs to console as fallback.
 */
export async function captureError(error: unknown, context?: ErrorContext): Promise<void> {
  // Always log to console
  console.error('[error]', error, context);

  const Sentry = await getSentry();
  if (!Sentry) return;

  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    extra: context,
    tags: {
      route: context?.route || 'unknown',
      userId: context?.userId,
      userRole: context?.userRole,
    },
  });
}

/**
 * Capture a message for breadcrumbs in Sentry.
 */
export async function captureMessage(
  level: 'info' | 'warning' | 'error',
  message: string,
  context?: ErrorContext
): Promise<void> {
  console.log(`[${level}]`, message, context);

  const Sentry = await getSentry();
  if (!Sentry) return;

  if (level === 'error') {
    Sentry.captureMessage(message, { extra: context });
  } else {
    Sentry.addBreadcrumb({ category: level, message, data: context });
  }
}

/**
 * Set a user context in Sentry for error attribution.
 */
export async function setUser(userId: string, userRole: string): Promise<void> {
  const Sentry = await getSentry();
  if (!Sentry) return;

  Sentry.setUser({ id: userId, email: undefined, username: userRole });
}
