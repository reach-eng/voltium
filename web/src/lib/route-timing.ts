/**
 * Route Timing Middleware
 *
 * Wraps API route handlers with timing, correlation ID tracking,
 * and APM metric recording.
 *
 * Usage:
 *   import { withTiming } from '@/lib/route-timing';
 *   export const GET = withTiming(async (req) => { ... }, 'admin.riders.list');
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCorrelationId, logRequestStart, logRequestEnd } from './correlation-id';
import { trackApiCall } from './apm';

type RouteHandler = (req: NextRequest, ...args: any[]) => Promise<NextResponse | Response>;

/**
 * Wraps a route handler with timing, logging, and APM tracking.
 * The `routeName` should follow the pattern: `module.action`
 * (e.g., `auth.sendOtp`, `kyc.submit`, `wallet.topup`).
 */
export function withTiming(handler: RouteHandler, routeName: string): RouteHandler {
  return async (req: NextRequest, ...args: any[]) => {
    const correlationId = getOrCreateCorrelationId(req);
    const startTime = performance.now();

    // Add correlation ID as a request header for downstream propagation
    // Log request start
    logRequestStart(req.method, req.nextUrl.pathname, correlationId, {
      routeName,
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    });

    let response: NextResponse | Response;

    try {
      response = await handler(req, ...args);
    } catch (err) {
      // Log the error
      const duration = performance.now() - startTime;
      logRequestEnd(req.method, req.nextUrl.pathname, 500, duration, correlationId, {
        routeName,
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      // Track as a failed API call
      trackApiCall(routeName, duration, false);

      // Return a structured error response
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Internal server error',
          },
          meta: { correlationId, timestamp: new Date().toISOString() },
        },
        { status: 500 }
      );
    }

    const duration = performance.now() - startTime;

    // Determine status code from response
    const statusCode = response.status || 200;

    // Log request completion
    logRequestEnd(req.method, req.nextUrl.pathname, statusCode, duration, correlationId, {
      routeName,
    });

    // Track the API call in APM
    trackApiCall(routeName, duration, statusCode < 500);

    // Add correlation ID to response headers
    if (response instanceof NextResponse || response instanceof Response) {
      response.headers.set('x-correlation-id', correlationId);
      response.headers.set('x-response-time', `${Math.round(duration)}ms`);
    }

    return response;
  };
}
