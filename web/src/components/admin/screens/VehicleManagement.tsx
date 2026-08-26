'use client';

import { AdminErrorBoundary } from '../error-boundary';
import { useVehicleManagement } from './vehicle-management/useVehicleManagement';
import { useVehicleKeyboard } from './vehicle-management/useVehicleKeyboard';
import { HeaderBar } from './vehicle-management/HeaderBar';
import { VehiclesTable } from './vehicle-management/VehiclesTable';
import { VehicleFilters } from './vehicle-management/VehicleFilters';
import { VehicleFormDialog } from './vehicle-management/VehicleFormDialog';
import { VehicleHistoryDialog } from './vehicle-management/VehicleHistoryDialog';
import { BulkActionDialogs } from './vehicle-management/BulkActionDialogs';
import { UndoToast } from './vehicle-management/UndoToast';

/**
 * R3.7e split — Vehicle management shell.
 *
 * Pre-split: 17.1 KB / 499 lines, 18 useState + 7 handlers + 200+ line render.
 * Post-split: thin orchestrator that wires the data hook, keyboard hook,
 * and 7 subcomponents. The state machine + all fetch logic live in
 * `useVehicleManagement` (10 KB); keyboard shortcuts in their own hook;
 * each dialog/filter/row/header in its own file under
 * `vehicle-management/`.
 */
export default function VehicleManagement() {
  const vm = useVehicleManagement();
  useVehicleKeyboard({
    filtered: vm.filtered,
    lastAction: vm.lastAction,
    bulkLoading: vm.bulkLoading,
    setSelectedIds: vm.setSelectedIds,
    handleUndo: vm.handleUndo,
  });

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <HeaderBar
          filteredCount={vm.filtered.length}
          totalCount={vm.vehicles.length}
          vehicles={vm.filtered}
          onAddClick={() => vm.setAddOpen(true)}
        />

        <VehicleFilters
          search={vm.search}
          setSearch={vm.setSearch}
          statusFilter={vm.statusFilter}
          setStatusFilter={vm.setStatusFilter}
          vehicles={vm.vehicles}
          filtered={vm.filtered}
          selectedIds={vm.selectedIds}
          setSelectedIds={vm.setSelectedIds}
          bulkLoading={vm.bulkLoading}
          setBulkStatusDialog={vm.setBulkStatusDialog}
          setBulkHubDialog={vm.setBulkHubDialog}
          setBulkDeleteOpen={vm.setBulkDeleteOpen}
          lastAction={vm.lastAction}
          handleUndo={vm.handleUndo}
        />

        <VehiclesTable
          loading={vm.loading}
          filtered={vm.filtered}
          totalCount={vm.vehicles.length}
          selectedIds={vm.selectedIds}
          onToggleAll={(checked) =>
            vm.setSelectedIds(checked ? new Set(vm.filtered.map((v) => v.id)) : new Set())
          }
          onToggleOne={vm.handleToggleSelect}
          onOpenHistory={vm.openHistory}
          onOpenEdit={vm.openEdit}
          onDelete={vm.setDeleteConfirm}
          search={vm.search}
          statusFilter={vm.statusFilter}
          currentPage={vm.currentPage}
          totalPages={vm.totalPages}
          onPageChange={vm.setCurrentPage}
        />

        <VehicleHistoryDialog
          open={vm.historyOpen}
          onOpenChange={vm.setHistoryOpen}
          selectedVehicle={vm.selectedVehicle}
          vehicleHistory={vm.vehicleHistory}
          historyLoading={vm.historyLoading}
        />

        <VehicleFormDialog
          mode="edit"
          open={vm.editOpen}
          onOpenChange={vm.setEditOpen}
          form={vm.form}
          setForm={vm.setForm}
          hubs={vm.hubs}
          error={vm.addEditError}
          setError={vm.setAddEditError}
          onSave={vm.handleEditVehicle}
          saving={vm.saving}
        />

        <VehicleFormDialog
          mode="add"
          open={vm.addOpen}
          onOpenChange={vm.setAddOpen}
          form={vm.form}
          setForm={vm.setForm}
          hubs={vm.hubs}
          error={vm.addEditError}
          setError={vm.setAddEditError}
          onSave={vm.handleAddVehicle}
        />

        <BulkActionDialogs
          deleteConfirm={vm.deleteConfirm}
          setDeleteConfirm={vm.setDeleteConfirm}
          onDelete={vm.handleDeleteVehicle}
          bulkDeleteOpen={vm.bulkDeleteOpen}
          setBulkDeleteOpen={vm.setBulkDeleteOpen}
          selectedCount={vm.selectedIds.size}
          bulkStatusDialog={vm.bulkStatusDialog}
          setBulkStatusDialog={vm.setBulkStatusDialog}
          bulkStatusValue={vm.bulkStatusValue}
          setBulkStatusValue={vm.setBulkStatusValue}
          bulkHubDialog={vm.bulkHubDialog}
          setBulkHubDialog={vm.setBulkHubDialog}
          bulkHubValue={vm.bulkHubValue}
          setBulkHubValue={vm.setBulkHubValue}
          hubs={vm.hubs}
          handleBulkAction={vm.handleBulkAction}
        />

        <UndoToast
          visible={vm.showUndoToast}
          count={vm.lastAction?.ids.length ?? 0}
          disabled={vm.bulkLoading}
          onUndo={vm.handleUndo}
        />
      </div>
    </AdminErrorBoundary>
  );
}
