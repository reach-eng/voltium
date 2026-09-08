'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AdminErrorBoundary } from '@/components/admin/error-boundary';
import {
  useKyc,
  KycFiltersBar,
  KycBulkActionsBar,
  KycTable,
  KycDetailDialog,
  KycDialogs,
} from './kyc-management';

function KycManagementTab() {
  const kyc = useKyc();

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <KycFiltersBar
          tab={kyc.tab}
          setTab={kyc.setTab}
          startDate={kyc.startDate}
          setStartDate={kyc.setStartDate}
          endDate={kyc.endDate}
          setEndDate={kyc.setEndDate}
          filteredRiders={kyc.filteredRiders}
          exportProgress={kyc.exportProgress}
          setExportProgress={kyc.setExportProgress}
        />

        <KycBulkActionsBar
          selectedIds={kyc.selectedIds}
          bulkLoading={kyc.bulkLoading}
          setBulkConfirmAction={kyc.setBulkConfirmAction}
        />

        <KycTable
          filteredRiders={kyc.filteredRiders}
          loading={kyc.loading}
          selectedIds={kyc.selectedIds}
          toggleSelect={kyc.toggleSelect}
          toggleSelectAll={kyc.toggleSelectAll}
          rowLoadingIds={kyc.rowLoadingIds}
          setSelectedRider={kyc.setSelectedRider}
          setConfirmAction={kyc.setConfirmAction}
          // NET-005 follow-up-12 (2026-09-08):
          // pagination props for the queue footer.
          page={kyc.page}
          totalPages={kyc.totalPages}
          total={kyc.total}
          onPageChange={kyc.setPage}
        />

        <KycDetailDialog
          selectedRider={kyc.selectedRider}
          setSelectedRider={kyc.setSelectedRider}
        />

        <KycDialogs
          confirmAction={kyc.confirmAction}
          setConfirmAction={kyc.setConfirmAction}
          rejectionReason={kyc.rejectionReason}
          setRejectionReason={kyc.setRejectionReason}
          selectedKycDocs={kyc.selectedKycDocs}
          setSelectedKycDocs={kyc.setSelectedKycDocs}
          handleKycAction={kyc.handleKycAction}
          actionLoading={kyc.actionLoading}
          selectedCount={kyc.selectedIds.size}
          bulkConfirmAction={kyc.bulkConfirmAction}
          setBulkConfirmAction={kyc.setBulkConfirmAction}
          bulkRejectionReason={kyc.bulkRejectionReason}
          setBulkRejectionReason={kyc.setBulkRejectionReason}
          handleBulkAction={kyc.handleBulkAction}
          bulkLoading={kyc.bulkLoading}
          showUndoToast={kyc.showUndoToast}
          setShowUndoToast={kyc.setShowUndoToast}
          lastAction={kyc.lastAction}
          handleUndo={kyc.handleUndo}
        />
      </div>
    </AdminErrorBoundary>
  );
}

export default function KycManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Onboarding / KYC</h2>
        <p className="text-muted-foreground text-sm">
          {/* NET-005 follow-up-15 (2026-09-08): removed
              "and guarantor submissions" — the Tabs
              scaffold below has a single "KYC Review"
              tab. Guarantor review lives on the
              rider-management screen, not here. The
              pre-fix copy promised a second tab the
              page never delivered. */}
          Review and approve rider KYC documents.
        </p>
      </div>
      <Tabs defaultValue="kyc" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="kyc" className="text-xs px-5 font-semibold">
            KYC Review
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kyc">
          <KycManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
