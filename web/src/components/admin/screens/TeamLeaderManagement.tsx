'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  UserCircle,
  Search,
  Users,
  X,
  CheckCircle2,
  Ban,
  Download,
  Undo2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface TeamLeader {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function TeamLeaderManagement() {
  const [leaders, setLeaders] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLeader, setEditLeader] = useState<TeamLeader | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', isActive: true });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<{
    ids: string[];
    previousStates: Record<string, any>;
    action: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<string[] | null>(null);
  const PAGE_SIZE = 21;

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);
  const mountedRef = useRef(true);

  const fetchLeaders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (activeFilter !== 'ALL') params.set('isActive', activeFilter);

      const res = await fetch(`/api/admin/team-leaders?${params}`);
      if (!mountedRef.current) return;
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setLeaders(json.data.leaders || []);
          if (json.data.pagination) {
            setTotalPages(json.data.pagination.totalPages);
            setTotalCount(json.data.pagination.total);
          }
        }
      }
    } catch {
      if (!mountedRef.current) return;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [page, debouncedSearch, activeFilter]);

  useEffect(() => {
    mountedRef.current = true;
    fetchLeaders();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchLeaders]);

  const openDialog = (leader?: TeamLeader) => {
    setError(null);
    if (leader) {
      setEditLeader(leader);
      setForm({
        name: leader.name,
        phone: leader.phone,
        email: leader.email || '',
        isActive: leader.isActive,
      });
    } else {
      setEditLeader(null);
      setForm({ name: '', phone: '', email: '', isActive: true });
    }
    setDialogOpen(true);
  };

  const saveLeader = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, email: form.email || null };
      const method = editLeader?.id ? 'PUT' : 'POST';
      const body = editLeader?.id ? { id: editLeader.id, ...payload } : payload;

      const res = await fetch('/api/admin/team-leaders', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error?.message || json?.message || `Failed with status ${res.status}`;
        setError(msg);
        return;
      }

      setDialogOpen(false);
      setForm({ name: '', phone: '', email: '', isActive: true });
      setEditLeader(null);
      fetchLeaders();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteLeader = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/team-leaders`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Delete failed');
        setDeleteTarget(null);
        return;
      }
      toast.success('Team leader deleted');
      setDeleteTarget(null);
      fetchLeaders();
    } catch {
      toast.error('Network error. Please try again.');
      setDeleteTarget(null);
    }
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteTargets || bulkDeleteTargets.length === 0) return;
    await handleBulkAction('delete');
    setBulkDeleteTargets(null);
  };

  const toggleActive = async (leader: TeamLeader) => {
    setToggleLoading(leader.id);
    try {
      const res = await fetch('/api/admin/team-leaders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leader.id, isActive: !leader.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to toggle status');
        return;
      }
      toast.success(leader.isActive ? 'Team leader deactivated' : 'Team leader activated');
      fetchLeaders();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setToggleLoading(null);
    }
  };

  async function handleBulkAction(action: string) {
    if (selectedIds.size === 0) return;
    const previousStates: Record<string, any> = {};
    leaders
      .filter((l) => selectedIds.has(l.id))
      .forEach((l) => {
        previousStates[l.id] = { isActive: l.isActive };
      });
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/team-leaders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Bulk action failed');
        setBulkLoading(false);
        return;
      }
      toast.success(`Bulk ${action} completed on ${selectedIds.size} team leader(s)`);
      setLastAction({ ids: Array.from(selectedIds), previousStates, action });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      setSelectedIds(new Set());
      fetchLeaders();
    } catch {
      toast.error('Bulk action failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleUndo() {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const results = await Promise.allSettled(
        Object.entries(lastAction.previousStates).map(([id, prev]) =>
          fetch('/api/admin/team-leaders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, isActive: prev.isActive }),
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error('Undo partial failure', { failed: failed.length, total: results.length });
        toast.error(`Undo partially failed (${failed.length}/${results.length})`);
      } else {
        toast.success('Undo successful');
      }
      setLastAction(null);
      setShowUndoToast(false);
      fetchLeaders();
    } catch {
      toast.error('Undo failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const filtered = leaders;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(filtered.map((l) => l.id)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, lastAction, bulkLoading]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Team Leaders</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage field team leaders and supervisors
          </p>
        </div>
        <Button onClick={() => openDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Team Leader
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
          />
        </div>
        <Select
          value={activeFilter}
          onValueChange={(e) => {
            setActiveFilter(e);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-40 rounded-xl border-muted-foreground/20 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {(search || activeFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setSearch('');
              setActiveFilter('ALL');
            }}
          >
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
            <span className="text-xs px-2 font-medium text-primary">
              {selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
              disabled={bulkLoading}
              onClick={() => handleBulkAction('activate')}
              title="Activate All"
            >
              {bulkLoading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              )}{' '}
              Activate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              disabled={bulkLoading}
              onClick={() => handleBulkAction('deactivate')}
              title="Deactivate All"
            >
              <Ban className="w-3 h-3 mr-1" /> Deactivate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              disabled={bulkLoading}
              onClick={() => setBulkDeleteTargets(Array.from(selectedIds))}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 hover:bg-muted-foreground/10 transition-all duration-200"
              onClick={() => {
                const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
                const header = [
                  esc('Name'),
                  esc('Phone'),
                  esc('Email'),
                  esc('Status'),
                  esc('Riders'),
                  esc('Created'),
                ].join(',');
                const rows = leaders
                  .filter((l) => selectedIds.has(l.id))
                  .map((l) =>
                    [
                      esc(l.name),
                      esc(l.phone),
                      esc(l.email || ''),
                      esc(l.isActive ? 'Active' : 'Inactive'),
                      esc(String((l as any).riderCount || 0)),
                      esc(l.createdAt),
                    ].join(',')
                  );
                const csv = [header, ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute(
                  'download',
                  `team-leaders-${new Date().toISOString().split('T')[0]}.csv`
                );
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
            {lastAction && (
              <>
                <div className="w-px h-4 bg-border/50 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 hover:bg-muted/10 transition-all duration-200"
                  disabled={bulkLoading}
                  onClick={handleUndo}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3 h-3 mr-1" /> Undo
                </Button>
              </>
            )}
            <div className="w-px h-4 bg-border/50 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-muted-foreground/10"
              onClick={() => setSelectedIds(new Set())}
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search || activeFilter !== 'ALL' ? 'No team leaders match' : 'No team leaders yet'}
        </div>
      ) : (
        <div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <Checkbox
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onCheckedChange={(checked) =>
                  setSelectedIds(checked ? new Set(filtered.map((l) => l.id)) : new Set())
                }
              />
              <span className="text-xs text-muted-foreground">Select All ({filtered.length})</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((l) => {
              const riderCount = (l as any).riderCount || 0;
              return (
                <Card
                  key={l.id}
                  className={
                    selectedIds.has(l.id) ? 'ring-2 ring-primary/30 bg-primary/[0.02]' : ''
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedIds.has(l.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds);
                            if (checked) next.add(l.id);
                            else next.delete(l.id);
                            setSelectedIds(next);
                          }}
                        />
                        <div
                          className={`p-2 rounded-full bg-primary/10 ${!l.isActive ? 'opacity-40' : ''}`}
                        >
                          <UserCircle
                            className={`h-6 w-6 ${l.isActive ? 'text-primary' : 'text-muted-foreground'}`}
                          />
                        </div>
                        <div>
                          <CardTitle className={`text-base ${!l.isActive ? 'opacity-50' : ''}`}>
                            {l.name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[10px] font-bold ${
                              l.isActive
                                ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                                : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                            }`}
                          >
                            {l.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{l.phone}</span>
                      </div>
                      {l.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{l.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {riderCount} rider{riderCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created: {formatDate(l.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t">
                      <Button
                        variant={l.isActive ? 'outline' : 'default'}
                        size="sm"
                        disabled={toggleLoading === l.id}
                        onClick={() => toggleActive(l)}
                      >
                        {toggleLoading === l.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : null}
                        {l.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Edit team leader"
                          onClick={() => openDialog(l)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500"
                          aria-label="Delete team leader"
                          onClick={() => setDeleteTarget(l.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editLeader ? 'Edit' : 'Add'} Team Leader</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email (optional)"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveLeader} disabled={!form.name || !form.phone || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Leader</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this team leader? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLeader}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={!!bulkDeleteTargets}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteTargets(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {bulkDeleteTargets?.length || 0} Team Leaders
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {bulkDeleteTargets?.length || 0} team leader(s)? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showUndoToast && lastAction && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <span className="text-sm">{lastAction.ids.length} team leader(s) updated</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 hover:bg-background/20 text-background"
            disabled={bulkLoading}
            onClick={handleUndo}
          >
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {totalCount} team leaders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
