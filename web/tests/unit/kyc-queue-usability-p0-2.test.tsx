/**
 * KYC Queue Usability Unit Tests (Phase 2 / P0-2)
 *
 * Covers:
 * 1. Default tab is 'submitted' (actionable cohort).
 * 2. PENDING rows are view-only:
 *    - Render only the View Documents button
 *    - Decision buttons (Approve, Needs Correction, Reject) are NOT rendered
 *    - Row checkbox is disabled so PENDING riders cannot be bulk-actioned
 * 3. SUBMITTED rows render all 3 decision buttons:
 *    - Approve (ShieldCheck)
 *    - Needs Correction (ShieldAlert)
 *    - Reject (ShieldX)
 * 4. INFO_REQUIRED rows hide Approve:
 *    - Approve is hidden (state machine forbids INFO_REQUIRED -> APPROVED without re-submission, 409 prevention)
 *    - Update Correction Request (ShieldAlert) and Reject (ShieldX) are rendered
 * 5. EXPIRED rows render Re-verify (RotateCcw) button only
 * 6. Tabs order in KycFiltersBar places 'submitted' first
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { KycTable } from '@/components/admin/screens/kyc-management/KycTable';
import { KycFiltersBar } from '@/components/admin/screens/kyc-management/KycFiltersBar';
import { buildKycQueueUrl } from '@/components/admin/screens/kyc-management/useKyc';
import { KYC_PAGE_SIZE } from '@/components/admin/screens/kyc-management/types';
import type { KycRider } from '@/components/admin/screens/kyc-management/types';

const KYC_DIR = path.resolve(__dirname, '../../src/components/admin/screens/kyc-management');

function makeRider(overrides: Partial<KycRider> = {}): KycRider {
  return {
    id: 'r-1',
    riderId: 'VF-RD-001',
    fullName: 'Test Rider',
    phone: '9876543210',
    kycStatus: 'SUBMITTED',
    state: 'SUBMITTED',
    lifecycleStatus: 'SUBMITTED',
    guarantorStatus: 'PENDING',
    guarantorName: 'Guarantor Name',
    sharedGuarantorWith: [],
    profilePhoto: 'https://cdn.example.com/photo.jpg',
    riderPhoto: null,
    signature: 'https://cdn.example.com/sig.png',
    aadhaarFront: 'https://cdn.example.com/af.jpg',
    aadhaarBack: 'https://cdn.example.com/ab.jpg',
    aadhaarNumber: 'XXXX-XXXX-1234',
    panCard: 'https://cdn.example.com/pan.jpg',
    panNumber: 'ABCDE1234F',
    bankName: 'HDFC',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
    kycRejectionReason: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  } as unknown as KycRider;
}

describe('Phase 2 / P0-2: KYC Queue Usability & Decision Button Scoping', () => {
  describe('1. Default tab is "submitted"', () => {
    const useKycSource = fs.readFileSync(path.join(KYC_DIR, 'useKyc.ts'), 'utf8');

    it('initializes tab state to "submitted" in useKyc.ts', () => {
      expect(useKycSource).toMatch(/const\s+\[tab,\s*setTab\]\s*=\s*useState\(['"]submitted['"]\);/);
      expect(useKycSource).not.toMatch(/const\s+\[tab,\s*setTab\]\s*=\s*useState\(['"]pending['"]\);/);
    });

    it('builds canonical URL with kycStatus=SUBMITTED for the default tab', () => {
      const url = buildKycQueueUrl({
        tab: 'submitted',
        startDate: '',
        endDate: '',
        page: 1,
        pageSize: KYC_PAGE_SIZE,
      });
      expect(url).toContain('kycStatus=SUBMITTED');
    });

    it('places Submitted as the first tab in KycFiltersBar.tsx', () => {
      const filtersBarSource = fs.readFileSync(path.join(KYC_DIR, 'KycFiltersBar.tsx'), 'utf8');
      const tabsMatch = filtersBarSource.match(/<TabsList>([\s\S]*?)<\/TabsList>/);
      expect(tabsMatch).toBeTruthy();
      const firstTabTrigger = tabsMatch![1].match(/<TabsTrigger\s+value="([^"]+)"/);
      expect(firstTabTrigger?.[1]).toBe('submitted');
    });
  });

  describe('2. PENDING rows are view-only', () => {
    it('renders ONLY the View Documents button on PENDING rows (no decision buttons)', () => {
      const pendingRider = makeRider({ kycStatus: 'PENDING' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[pendingRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      // View button is present
      expect(html).toContain('title="View Documents"');

      // Decision buttons are absent
      expect(html).not.toContain('title="Approve"');
      expect(html).not.toContain('title="Needs Correction"');
      expect(html).not.toContain('title="Reject"');
      expect(html).not.toContain('title="Re-verify');
    });

    it('disables the row selection checkbox on PENDING rows', () => {
      const pendingRider = makeRider({ kycStatus: 'PENDING' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[pendingRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      // Checkbox is disabled and has tooltip explaining why
      expect(html).toContain('disabled=""');
      expect(html).toContain('title="Pending riders cannot be bulk-actioned"');
    });
  });

  describe('3. SUBMITTED rows render full decision controls', () => {
    it('renders Approve, Needs Correction, and Reject buttons on SUBMITTED rows', () => {
      const submittedRider = makeRider({ kycStatus: 'SUBMITTED' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[submittedRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      expect(html).toContain('title="View Documents"');
      expect(html).toContain('title="Approve"');
      expect(html).toContain('title="Needs Correction"');
      expect(html).toContain('title="Reject"');
    });

    it('enables row checkbox for SUBMITTED rows', () => {
      const submittedRider = makeRider({ kycStatus: 'SUBMITTED' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[submittedRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      // In the table body (second checkbox), disabled is not present
      const bodyCheckboxes = html.split('<tbody')[1];
      expect(bodyCheckboxes).not.toContain('disabled=""');
    });
  });

  describe('4. INFO_REQUIRED rows hide Approve', () => {
    it('hides Approve on INFO_REQUIRED rows to prevent 409 transition errors', () => {
      const infoRider = makeRider({ kycStatus: 'INFO_REQUIRED' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[infoRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      // Approve is NOT rendered
      expect(html).not.toContain('title="Approve"');

      // Update correction and Reject are rendered
      expect(html).toContain('title="Update Correction Request"');
      expect(html).toContain('title="Reject"');
    });

    it('contains explanatory comment in KycTable.tsx documenting why Approve is hidden on INFO_REQUIRED', () => {
      const tableSource = fs.readFileSync(path.join(KYC_DIR, 'KycTable.tsx'), 'utf8');
      expect(tableSource).toMatch(/On INFO_REQUIRED, Approve is deliberately hidden/);
      expect(tableSource).toMatch(/throws 409/);
    });
  });

  describe('5. EXPIRED rows render Re-verify button only', () => {
    it('renders Re-verify button on EXPIRED rows', () => {
      const expiredRider = makeRider({ kycStatus: 'EXPIRED' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[expiredRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      expect(html).toContain('title="View Documents"');
      expect(html).toContain('title="Re-verify (re-open for re-submission)"');
      expect(html).not.toContain('title="Approve"');
      expect(html).not.toContain('title="Needs Correction"');
      expect(html).not.toContain('title="Reject"');
    });
  });

  describe('6. APPROVED and REJECTED rows are view-only', () => {
    it('renders no decision buttons on APPROVED rows', () => {
      const approvedRider = makeRider({ kycStatus: 'APPROVED' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[approvedRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      expect(html).toContain('title="View Documents"');
      expect(html).not.toContain('title="Approve"');
      expect(html).not.toContain('title="Needs Correction"');
      expect(html).not.toContain('title="Reject"');
      expect(html).not.toContain('title="Re-verify');
    });

    it('renders no decision buttons on REJECTED rows', () => {
      const rejectedRider = makeRider({ kycStatus: 'REJECTED' });

      const html = renderToStaticMarkup(
        <KycTable
          filteredRiders={[rejectedRider]}
          loading={false}
          selectedIds={new Set()}
          toggleSelect={() => {}}
          toggleSelectAll={() => {}}
          setSelectedRider={() => {}}
          setConfirmAction={() => {}}
          page={1}
          totalPages={1}
          total={1}
          onPageChange={() => {}}
          rowLoadingIds={new Set()}
        />
      );

      expect(html).toContain('title="View Documents"');
      expect(html).not.toContain('title="Approve"');
      expect(html).not.toContain('title="Needs Correction"');
      expect(html).not.toContain('title="Reject"');
      expect(html).not.toContain('title="Re-verify');
    });
  });
});
