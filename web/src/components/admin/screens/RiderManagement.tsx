'use client';

import { useEffect, useState } from 'react';
import { AddRiderModal } from './riders/AddRiderModal';
import { AdminErrorBoundary } from '../error-boundary';
import { RiderDetailModal } from './riders/RiderDetailModal';
import AdjustWalletModal from './rider-management/AdjustWalletModal';
import { DetailGroup } from './rider-management/DetailGroup';
import {
  RiderBulkDeleteDialog,
  RiderBulkActionsBar,
  RiderClearGuarantorDialog,
  RiderDeleteDialog,
  RiderDeleteDocDialog,
  RiderFiltersBar,
  RiderKycActionDialog,
  RiderUndoToast,
} from './rider-management';
import { RiderTable } from './rider-management/RiderTable';
import { useRiders } from './rider-management/useRiders';
import {
  getKycBadge,
  getStateBadge,
  RIDER_PERMISSIONS,
} from './rider-management/types';

/**
 * R3.7cc shell — composes the Rider Management screen from the
 * rider-management/ subdirectory. All data lives in `useRiders`;
 * the per-row components (table, detail modal, dialogs) live in
 * their own files.
 */
export default function RiderManagement() {
  const r = useRiders();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  // Ctrl+A/K/R/Z keyboard shortcuts — global
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        r.toggleSelectAll(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (r.selectedIds.size > 0 && !r.bulkLoading) {
          void r.handleBulkAction('updateStatus', 'POST_ACTIVE');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (r.selectedIds.size > 0 && !r.bulkLoading) {
          void r.handleBulkAction('updateStatus', 'SUSPENDED');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (r.lastAction && !r.bulkLoading) {
          void r.handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [r]);

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <RiderFiltersBar
          search={r.search}
          searching={r.searching}
          stateFilter={r.stateFilter}
          kycFilter={r.kycFilter}
          riders={r.riders}
          onSearchChange={r.setSearch}
          onStateFilterChange={r.setStateFilter}
          onKycFilterChange={r.setKycFilter}
          onAddRider={() => setShowAddDialog(true)}
          exportProgress={exportProgress}
          onExportStart={() => setExportProgress(0)}
          onExportProgress={(p) => setExportProgress(p)}
          onExportComplete={() => setExportProgress(null)}
        />

        <RiderBulkActionsBar
          selectedCount={r.selectedIds.size}
          bulkLoading={r.bulkLoading}
          canUndo={!!r.lastAction}
          allRiders={r.riders}
          selectedIds={r.selectedIds}
          onApprove={() => {
            void r.handleBulkAction('updateStatus', 'POST_ACTIVE');
          }}
          onSuspend={() => {
            void r.handleBulkAction('updateStatus', 'SUSPENDED');
          }}
          onDelete={() => r.setConfirmDelete(r.riders.find((x) => r.selectedIds.has(x.id))?.id ?? '')}
          onUndo={() => {
            void r.handleUndo();
          }}
          onClear={r.clearSelection}
        />

        {/* Keyboard Shortcuts Hint */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Ctrl+A Select All · Ctrl+K Approve · Ctrl+R Suspend · Ctrl+Z Undo
          </span>
        </div>

        <RiderTable
          riders={r.riders}
          loading={r.loading}
          page={r.page}
          totalPages={r.totalPages}
          total={r.total}
          sortKey={r.sortKey}
          sortDir={r.sortDir}
          selectedIds={r.selectedIds}
          onToggleAll={r.toggleSelectAll}
          onToggleOne={r.toggleSelectOne}
          onSort={r.onSort}
          onPageChange={r.setPage}
          onViewDetails={(rider) => r.setSelectedRider(rider)}
          onDelete={(id) => r.handleDeleteRider(id)}
        />

        <RiderDetailModal
          selectedRider={r.selectedRider}
          setSelectedRider={r.setSelectedRider}
          isEditing={r.isEditing}
          setIsEditing={r.setIsEditing}
          editForm={r.editForm}
          setEditForm={r.setEditForm}
          saving={r.saving}
          handleUpdateRider={r.handleUpdateRider}
          startEditing={r.startEditing}
          setDeleteDocKey={r.setDeleteDocKey}
          setConfirmKycAction={r.setConfirmKycAction}
          setKycRejectionReason={r.setKycRejectionReason}
          setConfirmClearGuarantor={r.setConfirmClearGuarantor}
          setConfirmDelete={r.setConfirmDelete}
          setShowAdjustWallet={() => {
            /* wallet modal opened via RiderDetailModal */
          }}
          handleTlAction={r.handleTlAction}
          getKycBadge={getKycBadge}
          getStateBadge={getStateBadge}
          DetailGroup={DetailGroup}
          selectedKycDocs={r.selectedKycDocs}
          toggleKycDoc={r.toggleKycDoc}
          handleDeleteKycDoc={r.handleDeleteKycDoc}
          handleClearGuarantor={r.handleClearGuarantor}
          permissions={RIDER_PERMISSIONS}
        />

        <AddRiderModal
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSuccess={r.fetchRiders}
        />

        <RiderDeleteDialog
          open={!!r.confirmDelete}
          onOpenChange={(open) => {
            if (!open) r.setConfirmDelete(null);
          }}
          onConfirm={() => {
            if (r.confirmDelete) void r.handleDeleteRider(r.confirmDelete);
          }}
        />

        <RiderKycActionDialog
          state={r.confirmKycAction}
          reason={r.kycRejectionReason}
          saving={r.saving}
          onReasonChange={r.setKycRejectionReason}
          onOpenChange={(open) => {
            if (!open) {
              r.setConfirmKycAction(null);
              r.setKycRejectionReason('');
            }
          }}
          onConfirm={() => {
            void r.handleKycAction();
          }}
        />

        <RiderDeleteDocDialog
          docKey={r.deleteDocKey}
          onOpenChange={(open) => {
            if (!open) r.setDeleteDocKey(null);
          }}
          onConfirm={() => {
            void r.confirmDeleteKycDoc();
          }}
        />

        <RiderClearGuarantorDialog
          open={r.confirmClearGuarantor}
          onOpenChange={(open) => r.setConfirmClearGuarantor(open)}
          onConfirm={() => {
            void r.confirmClearGuarantorAction();
          }}
        />

        <RiderBulkDeleteDialog
          open={false}
          count={r.selectedIds.size}
          onOpenChange={(open) => {
            if (!open) {
              /* close */
            }
          }}
          onConfirm={() => {
            void r.handleBulkAction('delete');
          }}
        />

        <RiderUndoToast
          visible={r.showUndoToast}
          count={r.lastAction?.ids.length ?? 0}
          action={r.lastAction?.action ?? ''}
          busy={r.bulkLoading}
          onUndo={() => {
            void r.handleUndo();
          }}
          onDismiss={() => r.setShowUndoToast(false)}
        />

        {r.selectedRider && (
          <AdjustWalletModal
            riderId={r.selectedRider.id}
            currentBalance={r.selectedRider.walletBalance}
            isOpen={true}
            onClose={() => r.setSelectedRider(null)}
            onSuccess={() => {
              void r.fetchRiders();
            }}
          />
        )}
      </div>
    </AdminErrorBoundary>
  );
}
