import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { getPermissionsForRole } from '@/lib/permissions';
import { toast } from 'sonner';
import type { Admin, AdminForm } from './types';

export function useAdminUsers() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminForm>({
    name: '',
    email: '',
    password: '',
    role: 'OPERATIONS_ADMIN',
    permissions: [],
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const debouncedSearch = useDebounce(search, 500);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: debouncedSearch,
      });

      const res = await fetch(`/api/admin/admins?${params.toString()}`);
      if (!res.ok) {
        toast.error('Failed to load admin users');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setAdmins(json.data || []);
        if (json.pagination) {
          setPagination({
            total: json.pagination.total,
            totalPages: json.pagination.totalPages,
          });
        }
      }
    } catch {
      toast.error('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const saveAdmin = async () => {
    if (!form.name || !form.email || (!editingId && !form.password)) return;
    try {
      const url = '/api/admin/admins';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...form, id: editingId } : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || json.error || 'Failed to save admin user');
        return;
      }

      toast.success(editingId ? 'Admin updated successfully' : 'Admin created successfully');
      setDialogOpen(false);
      setEditingId(null);
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'OPERATIONS_ADMIN',
        permissions: [],
      });
      fetchAdmins();
    } catch {
      toast.error('Failed to save admin user');
    }
  };

  // P1-1 (ADMIN_ADMIN_USERS_AUDIT_2026-08-24): surface corrupted permissions
  // JSON. The previous behaviour silently fell back to role defaults, which
  // destroys the admin's custom grants on the next save. Now: log the
  // parse error, set a banner state, and the parent screen can show a
  // "permissions were corrupted — restored from role defaults" warning so
  // the super-admin knows to escalate to engineering.
  const [editCorruptionWarning, setEditCorruptionWarning] = useState<string | null>(null);
  // P0-1: state for the deactivate-confirm dialog (admin + reason input).
  const [pendingToggle, setPendingToggle] = useState<{ admin: Admin; isDeactivate: boolean } | null>(null);
  // P1-3: state for the role-change warning dialog (admin + prev perms + new role).
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    admin: Admin;
    nextRole: string;
    removed: string[];
  } | null>(null);

  const handleEdit = (admin: Admin) => {
    let perms: string[] = [];
    let corrupted = false;
    try {
      const raw = admin.permissions || '[]';
      const parsed = JSON.parse(raw);
      perms = Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
    } catch (err) {
      // P1-1: corrupted JSON. Log and fall back to role defaults — the
      // super-admin will see a warning so the loss is visible.
      // eslint-disable-next-line no-console
      console.error('[useAdminUsers] Corrupted permissions JSON for admin', admin.id, err);
      perms = getPermissionsForRole(admin.role);
      corrupted = true;
    }

    setForm({
      name: admin.name,
      email: admin.email,
      password: '',
      role: admin.role,
      permissions: perms,
    });
    setEditingId(admin.id);
    setDialogOpen(true);
    setEditCorruptionWarning(
      corrupted
        ? 'The stored permissions were corrupted and have been restored from the role defaults. Please verify before saving.'
        : null
    );
  };

  const handleRoleChange = (role: string) => {
    const defaultPerms = getPermissionsForRole(role);
    setForm((prev) => ({ ...prev, role, permissions: defaultPerms }));
  };

  const togglePermission = (key: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((k) => k !== key)
        : [...prev.permissions, key],
    }));
  };

  // P0-1 (ADMIN_ADMIN_USERS_AUDIT_2026-08-24): `reason` is required when
  // deactivating (the confirm dialog enforces it on the client) and forwarded
  // to the server so the audit log entry has a human-readable justification
  // alongside the actorId / ip / sessionId. Activation does not require a
  // reason.
  const toggleActive = async (admin: Admin, { reason }: { reason?: string } = {}) => {
    const willDeactivate = admin.isActive;
    if (willDeactivate && !reason) {
      toast.error('A reason is required to deactivate an admin');
      return;
    }
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: admin.id,
          isActive: !admin.isActive,
          ...(reason ? { reason } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || json.error || 'Failed to update admin status');
        return;
      }
      toast.success(`Admin ${!admin.isActive ? 'activated' : 'deactivated'} successfully`);
      fetchAdmins();
    } catch {
      toast.error('Failed to update admin status');
    }
  };

  return {
    admins,
    loading,
    dialogOpen,
    setDialogOpen,
    editingId,
    setEditingId,
    form,
    setForm,
    search,
    setSearch,
    page,
    setPage,
    pagination,
    fetchAdmins,
    saveAdmin,
    handleEdit,
    handleRoleChange,
    togglePermission,
    toggleActive,
    // P1-1: warning banner when the stored permissions JSON was corrupted.
    editCorruptionWarning,
    dismissEditCorruptionWarning: () => setEditCorruptionWarning(null),
    // P0-1: state for the deactivate-confirm dialog.
    pendingToggle,
    setPendingToggle,
    requestToggleActive: (admin: Admin) =>
      setPendingToggle({ admin, isDeactivate: admin.isActive }),
    cancelToggle: () => setPendingToggle(null),
    // P1-3: state for the role-change warning dialog.
    pendingRoleChange,
    setPendingRoleChange,
    requestRoleChange: (nextRole: string) => {
      if (!editingId) {
        handleRoleChange(nextRole);
        return;
      }
      const currentPerms = new Set(form.permissions);
      const nextPerms = new Set(getPermissionsForRole(nextRole));
      const removed = form.permissions.filter((p) => !nextPerms.has(p));
      if (removed.length > 0 && currentPerms.size > nextPerms.size) {
        // Show warning if the change actually drops custom permissions.
        setPendingRoleChange({
          admin: { id: editingId } as Admin,
          nextRole,
          removed,
        });
        return;
      }
      handleRoleChange(nextRole);
    },
    cancelRoleChange: () => setPendingRoleChange(null),
    confirmRoleChange: () => {
      if (pendingRoleChange) {
        handleRoleChange(pendingRoleChange.nextRole);
        setPendingRoleChange(null);
      }
    },
  };
}
