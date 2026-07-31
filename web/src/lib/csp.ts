import { env } from './env';

const isProd = env.APP_ENV === 'production';

export const getDevCsp = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://*.google.com https://*.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com",
    "img-src 'self' data: https://placehold.co https://*.unsplash.com https://*.googleapis.com https://*.google.com https://*.gstatic.com blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' http://localhost:* https://api.voltium.app ws://localhost:* wss://localhost:* https://*.googleapis.com https://*.google.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

export const getProdCsp = (nonce: string) =>
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

export function getSecurityHeaders(nonce: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Content-Security-Policy': isProd ? getProdCsp(nonce) : getDevCsp(nonce),
  };

  if (isProd) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}
