'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  ShieldAlert,
  Shield,
  UserCog,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string;
  lastLoginAt: string | null;
  createdAt: string;
}

import { PERMISSION_DESCRIPTORS, getPermissionsForRole } from '@/lib/auth';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'border-red-500/20 text-red-600 bg-red-500/5 dark:text-red-400',
  ADMIN: 'border-primary/20 text-primary bg-primary/5',
  MANAGER: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  FLEET_MANAGER: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  TEAM_LEADER: 'border-cyan-500/20 text-cyan-600 bg-cyan-500/5 dark:text-cyan-400',
};

export default function AdminUserManagement() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ADMIN',
    permissions: [] as string[],
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
        setForm({ name: '', email: '', password: '', role: 'ADMIN', permissions: [] });
        fetchAdmins();
      }
    } catch {
      /* empty */
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
      password: '', // Don't show password
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatDateTime = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const filtered = search
    ? admins.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.email.toLowerCase().includes(search.toLowerCase())
      )
    : admins;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Users</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage admin panel access and roles</p>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-red-600 dark:text-red-400 text-sm">Super Admin Only</p>
          <p className="text-xs text-red-500 dark:text-red-400/80 mt-0.5">
            This section is restricted to Super Admins only. Role changes and admin creation require
            SUPER_ADMIN privileges.
          </p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-10 rounded-xl border-muted-foreground/20 text-sm shadow-sm"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl h-10 px-4">
          <Plus className="h-4 w-4 mr-1" /> Add New Admin
        </Button>
      </div>

      {/* Admins Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  Loading admins...
                </TableCell>
              </TableRow>
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search ? 'No admins match your search' : 'No admins found'}
                </TableCell>
              </TableRow>
            ) : (
              admins.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {a.role === 'SUPER_ADMIN' ? (
                        <Shield className="h-4 w-4 text-red-500" />
                      ) : (
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={!a.isActive ? 'opacity-50' : ''}>{a.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{a.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${roleColors[a.role] || 'border-slate-500/20 text-slate-600 bg-slate-500/5'}`}
                    >
                      {a.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        a.isActive
                          ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                          : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                      }`}
                    >
                      {a.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Never'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(a.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(a)}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={a.isActive ? 'outline' : 'default'}
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => toggleActive(a)}
                      >
                        {a.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-card px-4 py-3 rounded-xl border border-border/50 shadow-sm">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Showing <span className="font-medium">{(page - 1) * 20 + 1}</span> to{' '}
            <span className="font-medium">{Math.min(page * 20, pagination.total)}</span> of{' '}
            <span className="font-medium">{pagination.total}</span> Admins
          </div>
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-2 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium px-2">
              Page {page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="h-8 px-2 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setForm({ name: '', email: '', password: '', role: 'ADMIN', permissions: [] });
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Admin' : 'Add New Admin'}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@voltium.in"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{editingId ? 'New Password (Optional)' : 'Password'}</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingId ? 'Leave blank to keep same' : 'Initial password'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={handleRoleChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="FLEET_MANAGER">Fleet Manager</SelectItem>
                      <SelectItem value="TEAM_LEADER">Team Leader</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Granular Permissions</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRoleChange(form.role)}
                    className="text-[10px] h-7 text-primary"
                  >
                    Reset to Role Defaults
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 border rounded-xl p-4 bg-muted/30">
                  {['Riders', 'Vehicles', 'Finance', 'Support', 'Marketing', 'System'].map(
                    (category) => (
                      <div key={category} className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-1">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {PERMISSION_DESCRIPTORS.filter((p) => p.category === category).map(
                            (p) => (
                              <div key={p.key} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`perm-${p.key}`}
                                  checked={form.permissions.includes(p.key)}
                                  onCheckedChange={() => togglePermission(p.key)}
                                />
                                <Label
                                  htmlFor={`perm-${p.key}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {p.label}
                                </Label>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveAdmin}
              disabled={!form.name || !form.email || (!editingId && !form.password)}
            >
              {editingId ? 'Save Changes' : 'Create Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
