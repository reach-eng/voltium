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

  const handleEdit = (admin: Admin) => {
    let perms: string[] = [];
    try {
      perms = JSON.parse(admin.permissions || '[]');
    } catch {
      perms = getPermissionsForRole(admin.role);
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
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
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
  };
}
