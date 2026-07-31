/**
 * R3 split (AdminUserManagement) — header.
 *
 * H2 + subtitle. Pure presentational, no actions.
 */
export function AdminUsersHeader() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">Admin Users</h2>
      <p className="text-muted-foreground text-sm mt-1">Manage admin panel access and roles</p>
    </div>
  );
}
