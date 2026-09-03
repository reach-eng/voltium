/**
 * Edge-safe security headers (CSP/HSTS). P1 split from `src/middleware.ts`.
 *
 * Edge-safe: no Node-only imports (no db, logger, jose). Safe to import
 * from middleware and from tests.
 */

// PR-112 (SEC PR-5): canonical APP_ENV drives the strict CSP + HSTS.
export const isProdEdge =
  process.env.APP_ENV === 'production' ||
  process.env.APP_ENV === 'staging' ||
  process.env.NODE_ENV === 'production';

const getDevCsp = () =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com",
    "img-src 'self' data: https://placehold.co https://*.unsplash.com https://*.googleapis.com https://*.google.com https://*.gstatic.com blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.voltium.app ws://localhost:* wss://localhost:* ws://127.0.0.1:* https://*.googleapis.com https://*.google.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

const getProdCsp = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.google.com https://*.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com",
    "img-src 'self' data: https://placehold.co https://*.unsplash.com https://*.googleapis.com https://*.google.com https://*.gstatic.com blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' https://api.voltium.app https://*.googleapis.com https://*.google.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

export function getEdgeSecurityHeaders(nonce: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Content-Security-Policy': isProdEdge ? getProdCsp(nonce) : getDevCsp(),
  };

  if (isProdEdge) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}
