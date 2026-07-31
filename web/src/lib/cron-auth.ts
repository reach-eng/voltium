import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'crypto';

// ━ Phase 1 C5 fix: shared cron auth helper ━
// Fails CLOSED if CRON_SECRET is unset or weak (returns 503, not open).
// Uses SHA-256 hashing before timingSafeEqual to prevent secret-length timing leaks.
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      {
        success: false,
        error: 'Cron service is misconfigured: CRON_SECRET must be set and at least 16 characters.',
      },
      { status: 503 }
    );
  }
  const auth = request.headers.get('authorization') || '';
  // R10 polish #14 (Security 7.2) — Bearer scheme is case-insensitive per
  // RFC 6750 §2.1. Accept "bearer", "Bearer", "BEARER", etc. so deployments
  // behind proxies that normalize the header don't get locked out.
  const token = /^bearer\s+(.+)$/i.exec(auth)?.[1] ?? '';
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // DoS cap: reject absurdly large tokens
  const MAX_TOKEN_LEN = 1024;
  if (token.length > MAX_TOKEN_LEN) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // Hash both inputs (always 32 bytes) then compare — constant-time regardless of input length.
  // This prevents the secret length from leaking via timing differences on length mismatch.
  const tokenHash = createHash('sha256').update(token).digest();
  const secretHash = createHash('sha256').update(secret).digest();
  if (!timingSafeEqual(tokenHash, secretHash)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null; // auth passed
}
