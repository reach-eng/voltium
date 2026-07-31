'use client';

import { useAdminUsers } from './useAdminUsers';
import { AdminUsersHeader } from './AdminUsersHeader';
import { SuperAdminBanner } from './SuperAdminBanner';
import { AdminFiltersBar } from './AdminFiltersBar';
import { AdminsTable } from './AdminsTable';
import { AdminFormDialog } from './AdminFormDialog';

/**
 * R3 split (AdminUserManagement) — admin users tab orchestrator.
 *
 * Pre-split: 19.6 KB / 550 lines with 7 useState + 4 fetch handlers
 * + form + dialogs + 7-col table all inline. Post-split: thin
 * orchestrator that wires the data hook and 5 subcomponents. The
 * data hook owns the form state, the search/pagination, the
 * permission toggles, and the network calls.
 */
export function AdminUsersTab() {
  const a = useAdminUsers();

  return (
    <div className="space-y-6">
      <AdminUsersHeader />
      <SuperAdminBanner />

      <AdminFiltersBar
        search={a.search}
        setSearch={a.setSearch}
        onPageReset={() => a.setPage(1)}
        onAddClick={a.openAddDialog}
      />

      <AdminsTable
        loading={a.loading}
        admins={a.filtered}
        search={a.search}
        page={a.page}
        totalPages={a.pagination.totalPages}
        total={a.pagination.total}
        onPageChange={a.setPage}
        onEdit={a.handleEdit}
        onToggleActive={a.toggleActive}
      />

      <AdminFormDialog
        open={a.dialogOpen}
        onOpenChange={a.setDialogOpen}
        isEdit={!!a.editingId}
        form={a.form}
        setForm={a.setForm}
        onSave={a.saveAdmin}
        onRoleChange={a.handleRoleChange}
        onTogglePermission={a.togglePermission}
      />
    </div>
  );
}
