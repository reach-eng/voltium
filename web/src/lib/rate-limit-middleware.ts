/**
 * Rate Limit Middleware — attaches X-RateLimit-* and Retry-After headers to responses.
 *
 * Wraps any response-building function with rate limit header injection.
 * This ensures every rate-limited endpoint returns headers clients need to back off.
 */

import { NextResponse } from 'next/server';
import { checkRateLimit, type RateLimitConfig, API_RATE_LIMIT } from './rate-limit';
import { logger } from './logger';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit and return headers-ready info.
 * Call this at the start of any route handler that should be rate-limited.
 */
export async function checkAndGetRateLimit(
  identifier: string,
  config: RateLimitConfig = API_RATE_LIMIT
): Promise<{ allowed: boolean; info: RateLimitInfo; response?: NextResponse }> {
  const result = await checkRateLimit(identifier, config);

  const info: RateLimitInfo = {
    limit: config.maxRequests,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };

  if (!result.allowed) {
    const waitSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    const response = NextResponse.json(
      {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
          'Retry-After': String(waitSeconds),
        },
      }
    );
    return { allowed: false, info, response };
  }

  return { allowed: true, info };
}

/**
 * Attach rate limit headers to an existing NextResponse.
 */
export function attachRateLimitHeaders(
  response: NextResponse,
  info: RateLimitInfo
): void {
  response.headers.set('X-RateLimit-Limit', String(info.limit));
  response.headers.set('X-RateLimit-Remaining', String(info.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(info.resetAt / 1000)));
}

const TRUSTED_PROXIES = new Set(
  (process.env.TRUSTED_PROXIES || '127.0.0.1,::1').split(',').map((ip) => ip.trim())
);

export function rateLimitIdentifierFromRequest(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return `ip:${cf.trim()}`;
  
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    
    // Parse X-Forwarded-For from right (closest proxy) to left (original client).
    // The real client IP is the first non-trusted IP encountered.
    let clientIp = ips[ips.length - 1];
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!TRUSTED_PROXIES.has(ips[i])) {
        clientIp = ips[i];
        break;
      }
    }
    return `ip:${clientIp || '127.0.0.1'}`;
  }

  // Fallback to Next.js specific ip property if available
  const nextIp = (request as any).ip;
  return `ip:${nextIp || '127.0.0.1'}`;
}
