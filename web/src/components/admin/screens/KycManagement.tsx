'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AdminErrorBoundary } from '@/components/admin/error-boundary';
import {
  useKyc,
  KycFiltersBar,
  KycBulkActionsBar,
  KycTable,
  KycDetailSheet,
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
          handleBulkAction={kyc.handleBulkAction}
          lastAction={kyc.lastAction}
          handleUndo={kyc.handleUndo}
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
        />

        <KycDetailSheet
          selectedRider={kyc.selectedRider}
          setSelectedRider={kyc.setSelectedRider}
        />

        <KycDialogs
          confirmAction={kyc.confirmAction}
          setConfirmAction={kyc.setConfirmAction}
          rejectionReason={kyc.rejectionReason}
          setRejectionReason={kyc.setRejectionReason}
          handleKycAction={kyc.handleKycAction}
          actionLoading={kyc.actionLoading}
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
          Review and approve rider KYC documents and guarantor submissions.
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
