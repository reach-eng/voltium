/**
 * Correlation ID Middleware
 *
 * Generates or propagates a unique correlation ID for every incoming request.
 * This ID is threaded through all log entries, error reports, and downstream
 * calls, making it possible to trace a single request across the entire system.
 *
 * Usage:
 *   - In API routes: const correlationId = getOrCreateCorrelationId(request);
 *   - In middleware.ts: run addCorrelationIdToResponse to pass it back to clients
 *   - The logger automatically picks up correlationId from context objects
 */

import { logger } from './logger';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const CORRELATION_ID_KEY = 'correlationId';

/**
 * Generate a new correlation ID.
 * Uses a timestamp + random string for uniqueness without external deps.
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split('-').slice(0, 2).join('');
  return `${timestamp}-${random}`;
}

/**
 * Get an existing correlation ID from a request, or generate a new one.
 */
export function getOrCreateCorrelationId(request?: Request | { headers: Headers }): string {
  if (request) {
    const existing = request.headers.get(CORRELATION_ID_HEADER);
    if (existing) return existing;
  }
  return generateCorrelationId();
}

/**
 * Create a context object with a correlation ID for use with the logger.
 */
export function withCorrelation(
  correlationId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    [CORRELATION_ID_KEY]: correlationId,
    ...extra,
  };
}

/**
 * Log the start of an API request with timing metadata.
 */
export function logRequestStart(
  method: string,
  path: string,
  correlationId: string,
  extra?: Record<string, unknown>
): void {
  logger.info(`[Request] ${method} ${path}`, {
    [CORRELATION_ID_KEY]: correlationId,
    method,
    path,
    requestStart: new Date().toISOString(),
    ...extra,
  });
}

/**
 * Log the completion of an API request with duration.
 */
export function logRequestEnd(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  correlationId: string,
  extra?: Record<string, unknown>
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[level](`[Response] ${method} ${path} → ${statusCode} (${durationMs.toFixed(1)}ms)`, {
    [CORRELATION_ID_KEY]: correlationId,
    method,
    path,
    statusCode,
    durationMs: Math.round(durationMs),
    ...extra,
  });
}

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  path?: string;
  [key: string]: unknown;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>
): Promise<T> {
  return Promise.resolve(asyncLocalStorage.run(context, fn));
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getCurrentRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

export function getCurrentCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}
