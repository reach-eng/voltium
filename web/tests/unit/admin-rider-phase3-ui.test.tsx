/**
 * Phase 3 UI unit tests (P0-3, P1-1, P1-2, P1-3, P1-4).
 *
 * Covers:
 * - P0-3: Review Photos button in RiderProfileTab wired to inspection tab switch in RiderDetailDialog.
 * - P1-1: Removal of 'VERIFIED' from RiderGuarantorTab options (only PENDING, SUBMITTED, APPROVED, REJECTED).
 * - P1-2: KYC action feedback (success/error toasts) and fresh list refetch.
 * - P1-3: Delete & Add rider feedback (success/error toasts, 409 handling, dialog retention).
 * - P1-4: List fetchError state and RiderTable error banner with Retry button vs empty-search copy.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { RiderTable, type RiderTableProps } from '@/components/admin/screens/rider-management/RiderTable';
import { RiderProfileTab } from '@/components/admin/screens/rider-management/detail/RiderProfileTab';
import { RiderGuarantorTab } from '@/components/admin/screens/rider-management/detail/RiderGuarantorTab';
import { Tabs } from '@/components/ui/tabs';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

const BASE_DIR = path.resolve(__dirname, '../../src/components/admin/screens/rider-management');

describe('Phase 3: P0-3 Review Photos Button and Controlled Tabs', () => {
  const dialogSource = fs.readFileSync(path.join(BASE_DIR, 'RiderDetailDialog.tsx'), 'utf8');
  const profileTabSource = fs.readFileSync(path.join(BASE_DIR, 'detail/RiderProfileTab.tsx'), 'utf8');

  it('RiderProfileTab accepts onReviewPhotos prop and attaches it to the button onClick', () => {
    expect(profileTabSource).toMatch(/onReviewPhotos\?: \(\) => void;/);
    expect(profileTabSource).toMatch(/onClick=\{onReviewPhotos\}/);

    const mockRider = {
      id: 'r-1',
      fullName: 'John Rider',
      phone: '9876543210',
      returnPending: true,
    } as unknown as Rider;

    const html = renderToStaticMarkup(
      <Tabs value="profile">
        <RiderProfileTab
          rider={mockRider}
          isEditing={false}
          editForm={{} as RiderEditForm}
          setEditForm={() => {}}
          onReviewPhotos={() => {}}
        />
      </Tabs>
    );

    expect(html).toContain('Vehicle Return Pending');
    expect(html).toContain('Review Photos');
  });

  it('RiderDetailDialog manages controlled activeTab and wires onReviewPhotos to inspection tab', () => {
    // Verifies controlled Tabs state is implemented
    expect(dialogSource).toMatch(/const\s+\[activeTab,\s*setActiveTab\]\s*=\s*useState\('profile'\);/);
    expect(dialogSource).toMatch(/<Tabs\s+value=\{activeTab\}\s+onValueChange=\{setActiveTab\}/);
    // Verifies onReviewPhotos switches to the inspection tab
    expect(dialogSource).toMatch(/onReviewPhotos=\{\(\)\s*=>\s*setActiveTab\('inspection'\)\}/);
  });
});

describe('Phase 3: P1-1 Guarantor Status Options (Removal of VERIFIED)', () => {
  const guarantorTabSource = fs.readFileSync(path.join(BASE_DIR, 'detail/RiderGuarantorTab.tsx'), 'utf8');

  it('RiderGuarantorTab options do NOT include VERIFIED and only include valid states', () => {
    expect(guarantorTabSource).not.toMatch(/'VERIFIED'/);
    expect(guarantorTabSource).toMatch(
      /options=\{?\['PENDING',\s*'SUBMITTED',\s*'APPROVED',\s*'REJECTED'\]\}?/
    );
  });

  it('RiderGuarantorTab renders only valid status options in the select element', () => {
    const mockRider = {
      id: 'r-1',
      fullName: 'John Rider',
      guarantorName: 'Bob Guarantor',
      guarantorStatus: 'PENDING',
    } as unknown as Rider;

    const html = renderToStaticMarkup(
      <Tabs value="guarantor">
        <RiderGuarantorTab
          rider={mockRider}
          isEditing={true}
          editForm={{ guarantorStatus: 'PENDING' } as any}
          setEditForm={() => {}}
          handleClearGuarantor={() => {}}
        />
      </Tabs>
    );

    expect(html).toContain('value="PENDING"');
    expect(html).toContain('value="SUBMITTED"');
    expect(html).toContain('value="APPROVED"');
    expect(html).toContain('value="REJECTED"');
    expect(html).not.toContain('value="VERIFIED"');
    expect(html).not.toContain('>VERIFIED<');
  });
});

describe('Phase 3: P1-2 & P1-3 Mutation Feedback in useRiders', () => {
  const useRidersSource = fs.readFileSync(path.join(BASE_DIR, 'useRiders.ts'), 'utf8');

  it('handleKycAction provides success and error toasts and refetches riders', () => {
    // Matches success toast on ok
    expect(useRidersSource).toMatch(/toast\.success\(`KYC status updated to \$\{kycStatus\}\.`\);/);
    // Matches refetch riders on ok
    expect(useRidersSource).toMatch(/await fetchRiders\(\);/);
    // Matches error toast on !res.ok
    expect(useRidersSource).toMatch(/KYC update failed/);
    // Matches error toast on catch
    expect(useRidersSource).toMatch(/toast\.error\('Failed to update KYC'\);/);
  });

  it('handleDeleteRider provides success and error toasts', () => {
    expect(useRidersSource).toMatch(/toast\.success\('Rider deleted\.'\);/);
    expect(useRidersSource).toMatch(/Delete failed/);
  });

  it('handleAddRider provides feedback, refetches riders, and handles 409 duplicate phone gracefully', () => {
    expect(useRidersSource).toMatch(/toast\.success\('Rider added\.'\);/);
    expect(useRidersSource).toMatch(/Failed to add rider/);
    // On error branch, setShowAddDialog(false) is NOT called so dialog stays open
    const handleAddMatch = useRidersSource.match(/const handleAddRider = useCallback[\s\S]*?\}, \[newRider, fetchRiders\]\);/);
    expect(handleAddMatch).toBeDefined();
    const handleAddBody = handleAddMatch![0];
    // In error branch, setShowAddDialog(false) must not occur
    const elseBranch = handleAddBody.split('} else {')[1]?.split('} catch')[0];
    expect(elseBranch).toBeDefined();
    expect(elseBranch).not.toContain('setShowAddDialog(false)');
  });
});

describe('Phase 3: P1-4 List Fetch Error & Retry State', () => {
  const useRidersSource = fs.readFileSync(path.join(BASE_DIR, 'useRiders.ts'), 'utf8');

  it('useRiders defines and exposes fetchError and onRetry', () => {
    expect(useRidersSource).toMatch(/const\s+\[fetchError,\s*setFetchError\]\s*=\s*useState<string\s*\|\s*null>\(null\);/);
    expect(useRidersSource).toMatch(/fetchError,/);
    expect(useRidersSource).toMatch(/onRetry:\s*fetchRiders,/);
  });

  const baseProps: RiderTableProps = {
    riders: [],
    loading: false,
    page: 1,
    totalPages: 1,
    total: 0,
    sortKey: null,
    sortDir: 'asc',
    selectedIds: new Set(),
    onToggleAll: () => {},
    onToggleOne: () => {},
    onSort: () => {},
    onPageChange: () => {},
    onViewDetails: () => {},
    onDelete: () => {},
  };

  it('RiderTable renders error banner with message and Retry button when fetchError is present', () => {
    const html = renderToStaticMarkup(
      <RiderTable
        {...baseProps}
        fetchError="Database connection timeout (503)"
        onRetry={() => {}}
      />
    );

    expect(html).toContain('Failed to load riders');
    expect(html).toContain('Database connection timeout (503)');
    expect(html).toContain('Retry');
  });

  it('RiderTable renders contextual empty-search message when search query produces no results', () => {
    const html = renderToStaticMarkup(
      <RiderTable
        {...baseProps}
        search="Ashok Kumar"
      />
    );

    expect(html).toContain('No riders matching &quot;Ashok Kumar&quot;');
    expect(html).not.toContain('Failed to load riders');
  });

  it('RiderTable renders default empty state when there are no riders and no search query', () => {
    const html = renderToStaticMarkup(
      <RiderTable
        {...baseProps}
      />
    );

    expect(html).toContain('No riders found');
    expect(html).not.toContain('Failed to load riders');
    expect(html).not.toContain('matching');
  });
});
