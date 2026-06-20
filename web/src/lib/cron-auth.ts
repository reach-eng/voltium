import { NextRequest, NextResponse } from 'next/server';

// ━ Phase 1 C5 fix: shared cron auth helper ━
// Fails CLOSED if CRON_SECRET is unset or weak (returns 503, not open).
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
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null; // auth passed
}
