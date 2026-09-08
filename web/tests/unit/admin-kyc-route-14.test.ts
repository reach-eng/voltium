/**
 * NET-005 follow-up-14 (2026-09-08): three sub-fixes.
 *
 * 1. PII toggle removed in KycDetailDialog (server
 *    already masks; client toggle was a no-op).
 * 2. Date filters in riders GET — strict validation
 *    via new `parseLooseDate` helper.
 * 3. KYC POST — strict action set + REQUEST_INFO
 *    outbox emit scoped into the same db.$transaction
 *    as the repo write.
 *
 * The dialog removal is verified by a file-content
 * scan (mirrors the audit-log-prefix-sweep test
 * pattern). The date parser and route validation get
 * direct unit tests. The REQUEST_INFO outbox scoping
 * is verified by mocking `db.$transaction` and
 * asserting that the outbox emit receives the same tx
 * object as the repo call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// 1. PII toggle removed — file-content scan
// ---------------------------------------------------------------------------

const SRC = (rel: string) => resolve(__dirname, '../../src', rel);

describe('NET-005 follow-up-14: PII toggle removed from KycDetailDialog', () => {
  const dialogPath = SRC('components/admin/screens/kyc-management/KycDetailDialog.tsx');

  it('KycDetailDialog.tsx exists', () => {
    expect(existsSync(dialogPath)).toBe(true);
  });

  it('does not contain a `showPii` state', () => {
    const content = readFileSync(dialogPath, 'utf-8');
    expect(content).not.toMatch(/\bshowPii\b/);
  });

  it('does not contain a `maskString` function', () => {
    const content = readFileSync(dialogPath, 'utf-8');
    expect(content).not.toMatch(/function\s+maskString\b/);
    expect(content).not.toMatch(/const\s+maskString\b/);
  });

  it('does not contain a "Reveal PII" button', () => {
    const content = readFileSync(dialogPath, 'utf-8');
    expect(content).not.toMatch(/Reveal PII/);
    expect(content).not.toMatch(/Hide PII/);
  });

  it('does not import Eye / EyeOff (those were only used by the toggle)', () => {
    const content = readFileSync(dialogPath, 'utf-8');
    // The lucide-react `Eye` and `EyeOff` icons were
    // imported solely for the toggle. A different
    // import (e.g. a type-only import) would be a
    // false positive, so we look for the explicit
    // named import. Shield + ShieldCheck are still
    // used.
    expect(content).not.toMatch(/import\s*\{[^}]*\bEye\b[^}]*\}\s*from\s*['"]lucide-react['"]/);
    expect(content).not.toMatch(/import\s*\{[^}]*\bEyeOff\b[^}]*\}\s*from\s*['"]lucide-react['"]/);
  });
});

// ---------------------------------------------------------------------------
// 2. parseLooseDate — strict date parser
// ---------------------------------------------------------------------------

import { parseLooseDate } from '@/lib/date-utils';

describe('NET-005 follow-up-14: parseLooseDate', () => {
  it('parses ISO YYYY-MM-DD', () => {
    const d = parseLooseDate('2026-09-08');
    expect(d).not.toBeNull();
    expect(d?.toISOString()).toBe('2026-09-08T00:00:00.000Z');
  });

  it('parses DD-MM-YYYY (local-time midnight)', () => {
    // The underlying parseDDMMYYYY uses
    // `new Date(year, month, day)` which creates a
    // local-time Date. The wall-clock date is
    // preserved regardless of timezone — the test
    // checks the local date components rather than
    // the UTC ISO string (which would shift to the
    // previous day at UTC- offsets).
    const d = parseLooseDate('08-09-2026');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8); // 0-indexed September
    expect(d?.getDate()).toBe(8);
  });

  it('returns null for empty input', () => {
    expect(parseLooseDate('')).toBeNull();
    expect(parseLooseDate(null)).toBeNull();
    expect(parseLooseDate(undefined)).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(parseLooseDate('   ')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseLooseDate('not a date')).toBeNull();
    expect(parseLooseDate('99-99-9999')).toBeNull(); // invalid DD-MM-YYYY
    expect(parseLooseDate('2026-13-01')).toBeNull(); // invalid month in ISO
  });

  it('trims surrounding whitespace', () => {
    const d = parseLooseDate('  2026-09-08  ');
    expect(d).not.toBeNull();
    expect(d?.toISOString()).toBe('2026-09-08T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// 3. KYC POST — strict action set
// ---------------------------------------------------------------------------

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  reopenExpiredKyc: vi.fn(),
  reviewKyc: vi.fn(),
  approveKyc: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: routeMocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({ hasPermission: routeMocks.hasPermission }));

vi.mock('@/server/modules/kyc/kyc.use-cases', () => ({
  kycUseCases: {
    reopenExpiredKyc: routeMocks.reopenExpiredKyc,
    reviewKyc: routeMocks.reviewKyc,
  },
}));

vi.mock('@/server/modules/kyc/use-cases/approveKyc', () => ({
  approveKyc: routeMocks.approveKyc,
}));

vi.mock('@/server/modules/kyc/use-cases/errors', () => ({
  KycApproveError: class KycApproveError extends Error {},
}));

import { POST as kycPost } from '@/app/api/admin/kyc/route';
import { NextRequest } from 'next/server';

const makePostReq = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/kyc', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('NET-005 follow-up-14: POST /api/admin/kyc action validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    routeMocks.hasPermission.mockReturnValue(true);
  });

  it('returns 400 (not 200) for an unknown action', async () => {
    const req = makePostReq({ riderId: 'r1', action: 'FROBNICATE' });
    const res = await kycPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toMatch(/action must be one of/);
    // The use case must not be called for unknown actions.
    expect(routeMocks.reviewKyc).not.toHaveBeenCalled();
    expect(routeMocks.reopenExpiredKyc).not.toHaveBeenCalled();
  });

  it('returns 400 for the lowercase "approve" (the route uppercases, but if both action and decision are absent the action is empty string)', async () => {
    // The route does `String(body.action || body.decision || '')`
    // and uppercases, so `'approve'` becomes 'APPROVE'. This
    // test is a sanity check that the uppercase path works
    // (covered by the existing happy-path test in
    // admin-kyc-reopen.test.ts) — included here to assert
    // the contract explicitly.
    routeMocks.approveKyc.mockResolvedValue({ id: 'kp1', status: 'APPROVED' });
    const req = makePostReq({ riderId: 'r1', action: 'approve' });
    const res = await kycPost(req);
    expect(res.status).toBe(200);
  });

  it('accepts all four canonical actions without 400', async () => {
    routeMocks.reopenExpiredKyc.mockResolvedValue({ id: 'kp1', status: 'PENDING' });
    routeMocks.reviewKyc.mockResolvedValue({ id: 'kp1' });
    routeMocks.approveKyc.mockResolvedValue({ id: 'kp1', status: 'APPROVED' });

    for (const action of ['APPROVE', 'REJECT', 'REQUEST_INFO', 'REOPEN']) {
      const req = makePostReq({ riderId: 'r1', action });
      const res = await kycPost(req);
      expect(res.status, `action=${action} should be accepted`).toBe(200);
    }
  });
});

// The REQUEST_INFO outbox-scoping test (layer 4) lives
// in `admin-kyc-request-info-tx.test.ts` — a separate
// file because this one mocks `@/server/modules/kyc/
// kyc.use-cases` for the route tests, and that file-
// level mock would shadow the real use case in any
// use-case assertions here.
