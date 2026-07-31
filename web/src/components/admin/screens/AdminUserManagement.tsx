'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import RolePermissionManagement from './RolePermissionManagement';
import AuditLogScreen from './AuditLogScreen';
import { AdminUsersTab } from './admin-users/AdminUsersTab';

/**
 * R3 split (AdminUserManagement) — shell.
 *
 * Pre-split: 19.6 KB / 550 lines containing 3 Tabs + 7 useState +
 * 4 handlers + 6 cards + 7-col table + permission dialog all inline.
 * Post-split: thin orchestrator. The Admin Users tab content lives
 * under `./admin-users/` (6 new files: types, useAdminUsers, header,
 * banner, filters bar, table, form dialog, tab orchestrator).
 */
export default function AdminUserManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Admin Access</h2>
        <p className="text-muted-foreground text-sm">
          Manage admin accounts, role permissions, and review the audit trail.
        </p>
      </div>
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="users" className="text-xs px-5 font-semibold">
            Admin Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs px-5 font-semibold">
            Roles &amp; Permissions
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs px-5 font-semibold">
            Audit Logs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <AdminUsersTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolePermissionManagement />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogScreen />
        </TabsContent>
      </Tabs>
    </div>
  );
}
