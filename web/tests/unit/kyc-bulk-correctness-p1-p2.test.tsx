/**
 * Phase 3 unit tests: Bulk correctness (P1-1, P1-2, P2-4)
 *
 * Covers:
 * - P1-1: Forward reason into bulkKyc, length validation (>=10 for reject, >=5 for info_required),
 *   per-action fallbacks.
 * - P1-2: Handle partial failures, surface counts + first failure error, retain failed IDs in selection,
 *   scope undo action only to succeeded IDs.
 * - P2-3: Clean error extraction from API response without producing '[object Object]'.
 * - P2-4: Page-scoped labeling in KycBulkActionsBar, KycDialogs, and RiderBulkActionsBar.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { KycBulkActionsBar } from '@/components/admin/screens/kyc-management/KycBulkActionsBar';
import { RiderBulkActionsBar } from '@/components/admin/screens/rider-management/RiderBulkActionsBar';

const KYC_DIR = path.resolve(__dirname, '../../src/components/admin/screens/kyc-management');
const ROUTE_FILE = path.resolve(__dirname, '../../src/app/api/admin/riders/bulk/route.ts');

describe('Phase 3: Bulk Correctness (P1-1, P1-2, P2-4)', () => {
  describe('P1-1: Bulk Route Reason Forwarding & Validation', () => {
    const routeSource = fs.readFileSync(ROUTE_FILE, 'utf8');

    it('validates minimum reason length for REJECTED and INFO_REQUIRED in bulk route', () => {
      expect(routeSource).toMatch(/kycStatus === 'REJECTED' && trimmedReason && trimmedReason\.length < 10/);
      expect(routeSource).toMatch(/kycStatus === 'INFO_REQUIRED' && trimmedReason && trimmedReason\.length < 5/);
    });

    it('forwards finalReason into adminRiderUseCases.update call', () => {
      expect(routeSource).toMatch(/kycStatus,\s*\.\.\.\(finalReason !== undefined \? \{ rejectionReason: finalReason \} : \{\}\)/);
    });
  });

  describe('P1-2 & P2-3: Hook Bulk Action Partial Failure & Error Parsing', () => {
    const useKycSource = fs.readFileSync(path.join(KYC_DIR, 'useKyc.ts'), 'utf8');

    it('extracts error messages from structured objects without producing [object Object]', () => {
      expect(useKycSource).toMatch(/extractErrorMessage\(errJson|errJson\.error && typeof errJson\.error === 'object' && errJson\.error\.message/);
    });

    it('parses count and failures from the bulk API response', () => {
      expect(useKycSource).toMatch(/const failures:\s*\{ id: string; error: string \}\[\]\s*=/);
      expect(useKycSource).toMatch(/const failedIds = new Set\(failures\.map\(\(f\) => f\.id\)\);/);
      expect(useKycSource).toMatch(/const succeededIds = targetIds\.filter\(\(id\) => !failedIds\.has\(id\)\);/);
    });

    it('retains selection on failed IDs when failures occur', () => {
      expect(useKycSource).toMatch(/if \(failures\.length > 0\) \{\s*\/\/[^\n]*\s*setSelectedIds\(failedIds\);/);
    });

    it('clears selection on full success', () => {
      expect(useKycSource).toMatch(/setSelectedIds\(new Set\(\)\);/);
    });

    it('surfaces toast.warning with count, total, failed count, and first failure message on partial failure', () => {
      expect(useKycSource).toMatch(/toast\.warning\(\s*`Updated \$\{updatedCount\} of \$\{targetIds\.length\} on this page \(\$\{failures\.length\} failed\$\{/);
    });

    it('surfaces toast.error when all selected items fail', () => {
      expect(useKycSource).toMatch(/toast\.error\(\s*`Failed to update \$\{failures\.length\} rider\(s\) on this page\$\{/);
    });

    it('records undo lastAction ONLY for succeeded IDs', () => {
      expect(useKycSource).toMatch(/if \(action !== 'approve' && succeededIds\.length > 0\)/);
      expect(useKycSource).toMatch(/ids: succeededIds,/);
    });
  });

  describe('P2-4: Page-Scoped Selection Labeling', () => {
    it('labels selected count with page scope in KycBulkActionsBar', () => {
      const html = renderToStaticMarkup(
        <KycBulkActionsBar
          selectedIds={new Set(['r1', 'r2', 'r3'])}
          bulkLoading={false}
          setBulkConfirmAction={() => {}}
        />
      );

      expect(html).toContain('3 selected on this page');
    });

    it('labels selected count with page scope in RiderBulkActionsBar', () => {
      const html = renderToStaticMarkup(
        <RiderBulkActionsBar
          selectedIds={new Set(['r1', 'r2'])}
          selectedCount={2}
          bulkLoading={false}
        />
      );

      expect(html).toContain('2 selected on this page');
    });

    const dialogsSource = fs.readFileSync(path.join(KYC_DIR, 'KycDialogs.tsx'), 'utf8');

    it('labels bulk approve dialog with page scope in description and confirm button', () => {
      expect(dialogsSource).toMatch(/selectedCount\}<\/strong>\s*selected rider\(s\) on this page/);
      expect(dialogsSource).toMatch(/`Approve \$\{selectedCount\} on This Page`/);
    });

    it('labels bulk reject dialog with page scope in title and button', () => {
      expect(dialogsSource).toMatch(/`Bulk Reject \(\$\{selectedCount\} selected on this page\)`/);
      expect(dialogsSource).toMatch(/`Reject \$\{selectedCount\} on This Page`/);
    });

    it('labels bulk request correction dialog with page scope in title and button', () => {
      expect(dialogsSource).toMatch(/`Bulk Request Correction \(\$\{selectedCount\} selected on this page\)`/);
      expect(dialogsSource).toMatch(/`Request Correction \(\$\{selectedCount\} on This Page\)`/);
    });
  });
});
