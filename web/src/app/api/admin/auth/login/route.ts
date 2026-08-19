import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import {
  createSessionToken,
  createRefreshToken,
  ADMIN_SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  ADMIN_SESSION_PHONE_MARKER,
} from '@/lib/auth';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { redactPii } from '@/lib/pii-redact';
import { parsePermissions } from '@/lib/permissions';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import { LoginError } from '@/server/modules/admin/login-error';
import { AdminLoginSchema } from '@/server/modules/admin/admin.schemas';

export async function POST(request: NextRequest) {
  try {
    // P3-6: CSRF defense-in-depth. The session cookie is SameSite=strict, so
    // cross-site requests can't ride the cookie — but a forged cross-site
    // POST to the login endpoint itself is still possible. Reject any
    // request whose Origin host doesn't match the Host header (or the
    // request URL host — undici/Next strip Host from constructed URLs in
    // some paths). Requests without an Origin (curl, server-to-server) are
    // allowed.
    const origin = request.headers.get('origin');
    // Browsers send the literal string "null" as Origin for sandboxed or
    // redirect-derived contexts — treat that as "no origin" rather than
    // 403ing a legitimate flow.
    if (origin && origin !== 'null') {
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return errors.forbidden('Cross-origin requests are not allowed');
      }
      const allowedHosts = [new URL(request.url).host];
      const hostHeader = request.headers.get('host');
      if (hostHeader) allowedHosts.push(hostHeader);
      // Caddy / Cloudflare-tunnel deployments sometimes rewrite Host; the
      // canonical forwarded host is a legitimate match candidate.
      const forwardedHost = request.headers.get('x-forwarded-host');
      if (forwardedHost) allowedHosts.push(forwardedHost);
      if (!allowedHosts.includes(originHost)) {
        return errors.forbidden('Cross-origin requests are not allowed');
      }
    }

    const clientIp = rateLimitIdentifierFromRequest(request).replace(/^ip:/, '');
    const ipRl = await checkRateLimit(`admin-login:${clientIp}`, AUTH_RATE_LIMIT);
    if (!ipRl.allowed) {
      return errors.tooManyRequests('Too many login attempts. Try again later.');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    // P3-20/21: single source of truth — the shared AdminLoginSchema from
    // admin.schemas.ts instead of a duplicate inline copy.
    const parsed = AdminLoginSchema.safeParse(body);
    if (!parsed.success) {
      return errors.validation(parsed.error.issues[0]?.message || 'Validation failed');
    }

    const { email, password } = parsed.data;

    // P0-4: per-email rate limit (DB-backed). The old in-memory per-(email,
    // IP) Map was per-process and keyed by IP, so a botnet rotating IPs got
    // 1000×5 attempts per account. Keying the same DB limiter by email means
    // an account can only be hit AUTH_RATE_LIMIT times per window no matter
    // how many origins are used.
    const emailRl = await checkRateLimit(`admin-login:email:${email.toLowerCase()}`, AUTH_RATE_LIMIT);
    if (!emailRl.allowed) {
      return errors.tooManyRequests('Too many login attempts. Try again later.');
    }

    const admin = await adminUseCases.login(email, password);

    // P2-1: if the permissions column can't be parsed, the session is issued
    // with empty adminPermissions — by design the role-based lookup in
    // hasPermission still applies (an unparseable column must never lock an
    // admin out, and role-derived permissions are the fallback).
    const permissions = parsePermissions(admin.permissions);

    const tokenPayload = {
      riderId: admin.id,
      riderDbId: admin.id,
      phone: ADMIN_SESSION_PHONE_MARKER, // P1-8: never the admin's email
      role: 'admin',
      adminRole: admin.role,
      adminId: admin.id,
      adminPermissions: permissions,
      tokenVersion: admin.tokenVersion,
    };

    const sessionToken = await createSessionToken(tokenPayload);

    // P1-13: the admin panel needs a refresh token for its background
    // refresh interceptor. The access token itself stays httpOnly-cookie
    // only; the refresh token is bearer-in-body, matching the contract the
    // refresh endpoint already returns.
    const refreshToken = await createRefreshToken(tokenPayload);

    // P2-2/P3-8: SOC2 — login events must be attributable to a source IP.
    logger.info('[Admin Login]', { adminId: admin.id, role: admin.role, ip: clientIp });

    const response = success(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        refreshToken,
      },
      'Login successful'
    );

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err: unknown) {
    // P0-7: typed error mapping instead of fragile message-string matching.
    if (err instanceof LoginError) {
      if (err.code === 'ACCOUNT_DEACTIVATED') {
        return errors.forbidden(err.message);
      }
      return errors.unauthorized('Invalid email or password');
    }
    logger.error('[POST /api/admin/auth/login]', redactPii(err));
    return errors.internal('Login failed');
  }
}
