'use client';

import dynamic from 'next/dynamic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AdminErrorBoundary } from '../error-boundary';
import {
  useAdminUsers,
  AdminUserTable,
} from './admin-users';

// Dynamic code-splitting for heavy tab contents and dialogs
const RolePermissionManagement = dynamic(() => import('./RolePermissionManagement'), {
  ssr: false,
});
const AuditLogScreen = dynamic(() => import('./AuditLogScreen'), {
  ssr: false,
});
const AdminUserDialog = dynamic(
  () => import('./admin-users/AdminUserDialogs').then((mod) => mod.AdminUserDialog),
  { ssr: false }
);

/**
 * AdminUserManagement — Main coordinator screen shell.
 * Delegates state management to useAdminUsers() and layout rendering
 * to modular components under ./admin-users/
 */
export default function AdminUserManagement() {
  const adminState = useAdminUsers();

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <Tabs defaultValue="admins">
          <TabsList className="bg-muted/40 p-1 h-10">
            <TabsTrigger value="admins" className="text-xs px-5 font-semibold">
              Admin Users &amp; RBAC
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-xs px-5 font-semibold">
              Role Presets
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs px-5 font-semibold">
              Security Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admins" className="mt-6">
            <AdminUserTable
              loading={adminState.loading}
              admins={adminState.admins}
              search={adminState.search}
              setSearch={adminState.setSearch}
              page={adminState.page}
              setPage={adminState.setPage}
              pagination={adminState.pagination}
              onAddClick={() => {
                adminState.setEditingId(null);
                adminState.setForm({
                  name: '',
                  email: '',
                  password: '',
                  role: 'OPERATIONS_ADMIN',
                  permissions: [],
                });
                adminState.setDialogOpen(true);
              }}
              onEdit={adminState.handleEdit}
              onToggleActive={adminState.toggleActive}
            />

            <AdminUserDialog
              open={adminState.dialogOpen}
              onOpenChange={adminState.setDialogOpen}
              editingId={adminState.editingId}
              form={adminState.form}
              setForm={adminState.setForm}
              onRoleChange={adminState.handleRoleChange}
              onTogglePermission={adminState.togglePermission}
              onSave={adminState.saveAdmin}
            />
          </TabsContent>

          <TabsContent value="roles" className="mt-6">
            <RolePermissionManagement />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AuditLogScreen />
          </TabsContent>
        </Tabs>
      </div>
    </AdminErrorBoundary>
  );
}
