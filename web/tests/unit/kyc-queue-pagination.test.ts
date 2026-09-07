/**
 * NET-005 follow-up-12 (2026-09-08): KYC queue paginates.
 *
 * Background:
 *   - The kyc-management screen's `useKyc.ts:31` hardcoded
 *     `limit=100` and never sent `page`, so the queue
 *     silently capped at the first 100 records with no
 *     way to navigate past them. The server already
 *     supported page-based pagination
 *     (`riders/route.ts:189-190`) and returned a
 *     `pagination: {page, limit, total, totalPages,
 *     nextCursor}` block.
 *   - The fix: extract a pure `buildKycQueueUrl` function
 *     from the hook, add `page`/`totalPages`/`total` state
 *     to the hook, render a pagination footer in
 *     `KycTable.tsx`, and reset `page` to 1 on filter
 *     change.
 *
 * This test pins the URL builder — the surface that the
 * rest of the wiring depends on. Adding more coverage
 * (e.g. a hook-level test that mocks `fetch` and asserts
 * the page state propagates into the URL) is left to a
 * React-renderer-equipped test suite; that infrastructure
 * doesn't exist in this repo's `tests/unit/` today.
 */

import { describe, it, expect } from 'vitest';
import { buildKycQueueUrl } from '@/components/admin/screens/kyc-management/useKyc';
import { KYC_PAGE_SIZE } from '@/components/admin/screens/kyc-management/types';

describe('NET-005 follow-up-12: KYC queue URL builder', () => {
  it('sends page=1 + limit=KYC_PAGE_SIZE on the default pending tab', () => {
    const url = buildKycQueueUrl({
      tab: 'pending',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).toContain('limit=100');
    expect(url).toContain('page=1');
    // The default tab is 'pending' which maps to
    // kycStatus=PENDING via the queue.
    expect(url).toContain('kycStatus=PENDING');
  });

  it('maps the info_required tab to kycStatus=INFO_REQUIRED', () => {
    const url = buildKycQueueUrl({
      tab: 'info_required',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).toContain('kycStatus=INFO_REQUIRED');
  });

  it('maps the submitted tab to kycStatus=SUBMITTED', () => {
    const url = buildKycQueueUrl({
      tab: 'submitted',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).toContain('kycStatus=SUBMITTED');
  });

  it('omits kycStatus for the all tab (server returns every rider)', () => {
    const url = buildKycQueueUrl({
      tab: 'all',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).not.toContain('kycStatus=');
  });

  it('uppercases other tab names (regression: e.g. "approved")', () => {
    const url = buildKycQueueUrl({
      tab: 'approved',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).toContain('kycStatus=APPROVED');
  });

  it('encodes the page number into the URL', () => {
    const url = buildKycQueueUrl({
      tab: 'pending',
      startDate: '',
      endDate: '',
      page: 7,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).toContain('page=7');
  });

  it('passes through startDate + endDate when set', () => {
    const url = buildKycQueueUrl({
      tab: 'pending',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).toContain('startDate=2026-01-01');
    expect(url).toContain('endDate=2026-01-31');
  });

  it('omits startDate + endDate when empty', () => {
    const url = buildKycQueueUrl({
      tab: 'pending',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).not.toContain('startDate=');
    expect(url).not.toContain('endDate=');
  });

  it('hits the canonical /api/admin/riders path', () => {
    const url = buildKycQueueUrl({
      tab: 'pending',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: KYC_PAGE_SIZE,
    });
    expect(url).toMatch(/^\/api\/admin\/riders\?/);
  });

  it('KYC_PAGE_SIZE is 100 (matches the server route max)', () => {
    // Regression lock: the server route's max limit is
    // 100 (`parsePositiveInt(..., 100)` in
    // `riders/route.ts:190`). A larger page size would
    // be silently clamped server-side; a smaller page
    // size would be a UX regression vs. the pre-fix
    // behavior.
    expect(KYC_PAGE_SIZE).toBe(100);
  });
});
