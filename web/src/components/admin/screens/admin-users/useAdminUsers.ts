'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { getPermissionsForRole } from '@/lib/permissions';
import {
  ADMIN_PAGE_SIZE,
  EMPTY_ADMIN_FORM,
  type Admin,
  type AdminForm,
} from './types';

/**
 * R3 split (AdminUserManagement) — admin users data hook.
 *
 * Owns the admin list, the search/pagination state, the add/edit
 * form, and the four network handlers (save, toggle active,
 * change role, edit prefill). The local `filtered` array is the
 * client-side name/email search; the server returns already
 * paginated rows.
 */
export function useAdminUsers() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminForm>({ ...EMPTY_ADMIN_FORM });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const debouncedSearch = useDebounce(search, 500);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: String(ADMIN_PAGE_SIZE),
        search: debouncedSearch,
      });

      const res = await fetch(`/api/admin/admins?${params.toString()}`);
      if (!res.ok) return;
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

      if (res.ok) {
        setDialogOpen(false);
        setEditingId(null);
        setForm({ ...EMPTY_ADMIN_FORM });
        fetchAdmins();
      }
    } catch {
      /* empty */
    }
  };

  const openAddDialog = () => {
    setEditingId(null);
    setForm({ ...EMPTY_ADMIN_FORM });
    setDialogOpen(true);
  };

  const handleEdit = (admin: Admin) => {
    let perms: string[] = admin.permissions || [];
    if (perms.length === 0) {
      perms = getPermissionsForRole(admin.role);
    }

    setForm({
      name: admin.name,
      email: admin.email,
      password: '', // Don't show password
      role: admin.role,
      permissions: perms,
    });
    setEditingId(admin.id);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_ADMIN_FORM });
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

  const toggleActive = async (admin: Admin) => {
    await fetch('/api/admin/admins', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
    });
    fetchAdmins();
  };

  const changeRole = async (admin: Admin, role: string) => {
    await fetch('/api/admin/admins', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: admin.id, role }),
    });
    fetchAdmins();
  };

  const filtered = search
    ? admins.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.email.toLowerCase().includes(search.toLowerCase())
      )
    : admins;

  return {
    // data
    admins,
    filtered,
    loading,
    pagination,
    // filters
    search,
    setSearch,
    page,
    setPage,
    // form
    dialogOpen,
    setDialogOpen,
    editingId,
    form,
    setForm,
    openAddDialog,
    closeDialog,
    handleEdit,
    saveAdmin,
    handleRoleChange,
    togglePermission,
    toggleActive,
    changeRole,
    // revalidation
    fetchAdmins,
  };
}

export type AdminUsersHook = ReturnType<typeof useAdminUsers>;
