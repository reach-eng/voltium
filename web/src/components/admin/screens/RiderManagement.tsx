'use client';

import { AdminErrorBoundary } from '../error-boundary';
import {
  AddRiderDialog,
  RiderBulkActionsBar,
  RiderBulkDeleteDialog,
  RiderClearGuarantorDialog,
  RiderDeleteDialog,
  RiderDeleteDocDialog,
  RiderDetailDialog,
  RiderFiltersBar,
  RiderKycActionDialog,
  RiderTable,
  RiderUndoToast,
  useRiders,
} from './rider-management';
import AdjustWalletModal from './rider-management/AdjustWalletModal';
import { Users } from 'lucide-react';

/**
 * RiderManagement — Main coordinator screen shell.
 * Delegates state management to useRiders() and layout rendering
 * to modular Presentational components under ./rider-management/
 */
export default function RiderManagement() {
  const riderState = useRiders();

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> Rider Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage rider onboarding, KYC status verification, active leases, and fleet assignments.
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <RiderFiltersBar
          {...riderState}
          onAddRider={() => riderState.setShowAddDialog(true)}
        />

        {/* Bulk Actions Toolbar */}
        <RiderBulkActionsBar
          selectedIds={riderState.selectedIds}
          bulkLoading={riderState.bulkLoading}
          onClear={() => riderState.setSelectedIds(new Set())}
          onApprove={() => riderState.handleBulkAction('APPROVED')}
          onSuspend={() => riderState.handleBulkAction('SUSPENDED')}
          onDelete={() => riderState.setBulkDeleteOpen(true)}
          onUndo={riderState.handleUndo}
          allRiders={riderState.riders}
        />

        {/* Main Data Table */}
        <RiderTable {...riderState} />

        {/* Add Rider Dialog */}
        <AddRiderDialog
          open={riderState.showAddDialog}
          onOpenChange={riderState.setShowAddDialog}
          newRider={riderState.newRider}
          setNewRider={riderState.setNewRider}
          onAdd={riderState.handleAddRider}
          adding={riderState.addingRider}
        />

        {/* Rider Details Sheet */}
        {riderState.selectedRider && (
          <RiderDetailDialog
            rider={riderState.selectedRider}
            onClose={() => riderState.setSelectedRider(null)}
            isEditing={riderState.isEditing}
            setIsEditing={riderState.setIsEditing}
            editForm={riderState.editForm as any}
            setEditForm={riderState.setEditForm as any}
            saving={riderState.saving}
            handleUpdateRider={riderState.handleUpdateRider}
            handleDeleteKycDoc={riderState.handleDeleteKycDoc}
            confirmDeleteKycDoc={riderState.confirmDeleteKycDoc}
            handleBulkDeleteKycDocs={riderState.handleBulkDeleteKycDocs}
            toggleKycDoc={riderState.toggleKycDoc}
            handleKycAction={riderState.handleKycAction}
            handleClearGuarantor={riderState.handleClearGuarantor}
            confirmClearGuarantorAction={riderState.confirmClearGuarantorAction}
            handleTlAction={riderState.handleTlAction}
            selectedKycDocs={riderState.selectedKycDocs}
            setSelectedKycDocs={riderState.setSelectedKycDocs}
            confirmKycAction={riderState.confirmKycAction}
            setConfirmKycAction={riderState.setConfirmKycAction}
            kycRejectionReason={riderState.kycRejectionReason}
            setKycRejectionReason={riderState.setKycRejectionReason}
            deleteDocKey={riderState.deleteDocKey}
            setDeleteDocKey={riderState.setDeleteDocKey}
            confirmClearGuarantor={riderState.confirmClearGuarantor}
            setConfirmClearGuarantor={riderState.setConfirmClearGuarantor}
            showAdjustWallet={riderState.showAdjustWallet}
            setShowAdjustWallet={riderState.setShowAdjustWallet}
          />
        )}

        {/* Confirmation & Action Dialogs */}
        <RiderDeleteDialog
          open={riderState.confirmDelete !== null}
          onOpenChange={(open) => !open && riderState.setConfirmDelete(null)}
          onConfirm={() => riderState.confirmDelete && riderState.handleDeleteRider(riderState.confirmDelete)}
        />

        <RiderBulkDeleteDialog
          open={riderState.bulkDeleteOpen}
          count={riderState.selectedIds.size}
          loading={riderState.bulkLoading}
          onOpenChange={riderState.setBulkDeleteOpen}
          onConfirm={() => riderState.handleBulkAction('DELETE')}
        />

        <RiderKycActionDialog
          state={riderState.confirmKycAction}
          reason={riderState.kycRejectionReason}
          saving={riderState.saving}
          onReasonChange={riderState.setKycRejectionReason}
          onOpenChange={(open) => !open && riderState.setConfirmKycAction(null)}
          onConfirm={riderState.handleKycAction}
        />

        <RiderDeleteDocDialog
          docKey={riderState.deleteDocKey}
          onOpenChange={(open) => !open && riderState.setDeleteDocKey(null)}
          onConfirm={riderState.confirmDeleteKycDoc}
        />

        <RiderClearGuarantorDialog
          open={riderState.confirmClearGuarantor}
          onOpenChange={riderState.setConfirmClearGuarantor}
          onConfirm={riderState.confirmClearGuarantorAction}
        />

        <RiderUndoToast
          show={riderState.showUndoToast}
          lastAction={riderState.lastAction}
          onUndo={riderState.handleUndo}
          onClose={() => riderState.setShowUndoToast(false)}
        />

        {riderState.selectedRider && (
          <AdjustWalletModal
            isOpen={riderState.showAdjustWallet}
            onClose={() => riderState.setShowAdjustWallet(false)}
            riderId={riderState.selectedRider.id}
            currentBalance={riderState.selectedRider.walletBalance || 0}
            onSuccess={(newBalance: number) => {
              if (riderState.selectedRider) {
                riderState.setSelectedRider({ ...riderState.selectedRider, walletBalance: newBalance });
              }
              riderState.fetchRiders();
            }}
          />
        )}
      </div>
    </AdminErrorBoundary>
  );
}
