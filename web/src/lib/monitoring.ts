/**
 * Voltium Local Monitoring
 *
 * Laptop-only production rule: no local logs, no cloud error tracking, and no
 * error payloads sent outside the server. This module writes sanitized events
 * to local logs only. Admin → Server Health and Audit Logs should be the
 * operational source of truth.
 */

import { logger } from '@/lib/logger';

type ErrorContext = {
  userId?: string;
  userRole?: string;
  route?: string;
  additional?: Record<string, unknown>;
};

function mask(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .replace(/(\+91\s?)?(\d{6})(\d{4})/g, (_m, p = '', _a, b) => `${p}******${b}`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***')
    .replace(/postgresql:\/\/[^"'\s]+/gi, 'postgresql://***');
}

function sanitizeContext(context?: ErrorContext): ErrorContext | undefined {
  if (!context) return undefined;
  return {
    userId: context.userId ? 'present' : undefined,
    userRole: context.userRole,
    route: context.route,
    additional: context.additional
      ? Object.fromEntries(Object.entries(context.additional).map(([k, v]) => [k, mask(v)]))
      : undefined,
  };
}

export async function captureError(error: unknown, context?: ErrorContext): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('[monitoring] local error captured', {
    message: mask(message),
    stack: error instanceof Error ? mask(error.stack || '') : undefined,
    context: sanitizeContext(context),
  });
}

export async function captureMessage(
  level: 'info' | 'warning' | 'error',
  message: string,
  context?: ErrorContext
): Promise<void> {
  const payload = { message: mask(message), context: sanitizeContext(context) };
  if (level === 'error') logger.error('[monitoring] local message', payload);
  else if (level === 'warning') logger.warn('[monitoring] local message', payload);
  else logger.info('[monitoring] local message', payload);
}

export async function setUser(_userId: string, _userRole: string): Promise<void> {
  // No-op by design. User context is not sent to any third-party service.
}
