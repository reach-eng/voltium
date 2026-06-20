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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Building2,
  Bike,
  Search,
  CheckCircle2,
  Ban,
  Download,
  X,
  Undo2,
  Loader2,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface Hub {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { vehicles: number };
  vehicleBreakdown?: {
    available: number;
    assigned: number;
    maintenance: number;
    retired: number;
    total: number;
  };
}

export default function HubManagement() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editHub, setEditHub] = useState<Hub | null>(null);
  const [form, setForm] = useState({ name: '', location: '', city: '', isActive: true });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<string[] | null>(null);
  const mountedRef = useRef(true);

  const fetchHubs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/hubs');
      if (!mountedRef.current) return;
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setHubs(json.data);
    } catch {
      if (!mountedRef.current) return;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchHubs();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchHubs]);

  const openDialog = (hub?: Hub) => {
    setError(null);
    if (hub) {
      setEditHub(hub);
      setForm({
        name: hub.name,
        location: hub.location || '',
        city: hub.city || '',
        isActive: hub.isActive,
      });
    } else {
      setEditHub(null);
      setForm({ name: '', location: '', city: '', isActive: true });
    }
    setDialogOpen(true);
  };

  const saveHub = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, location: form.location || null, city: form.city || null };
      const method = editHub?.id ? 'PUT' : 'POST';
      const body = editHub?.id ? { id: editHub.id, ...payload } : payload;

      const res = await fetch('/api/admin/hubs', {
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
      setForm({ name: '', location: '', city: '', isActive: true });
      setEditHub(null);
      fetchHubs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/admin/hubs', {
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
      setDeleteTarget(null);
      toast.success('Hub deleted');
      fetchHubs();
    } catch {
      toast.error('Network error. Please try again.');
      setDeleteTarget(null);
    }
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteTargets || bulkDeleteTargets.length === 0) return;
    await handleBulkAction('delete', bulkDeleteTargets);
    setBulkDeleteTargets(null);
  };

  const filtered = hubs.filter((h) => {
    if (statusFilter === 'ACTIVE' && !h.isActive) return false;
    if (statusFilter === 'INACTIVE' && h.isActive) return false;
    if (search) {
      const q = search.toLocaleLowerCase('en');
      if (
        !h.name.toLocaleLowerCase('en').includes(q) &&
        !(h.location || '').toLocaleLowerCase('en').includes(q) &&
        !(h.city || '').toLocaleLowerCase('en').includes(q)
      )
        return false;
    }
    return true;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(filtered.map((h) => h.id)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, lastAction, bulkLoading]);

  const toggleActive = async (hub: Hub) => {
    setToggleLoading(hub.id);
    try {
      const res = await fetch('/api/admin/hubs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hub.id, isActive: !hub.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to update hub status');
        return;
      }
      toast.success(hub.isActive ? 'Hub deactivated' : 'Hub activated');
      fetchHubs();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setToggleLoading(null);
    }
  };

  async function handleBulkAction(action: string, ids?: string[]) {
    const targetIds = ids || Array.from(selectedIds);
    if (targetIds.length === 0) return;
    const previousStates: Record<string, any> = {};
    hubs
      .filter((h) => targetIds.includes(h.id))
      .forEach((h) => {
        previousStates[h.id] = { isActive: h.isActive };
      });
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/hubs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: targetIds, action }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Bulk action failed');
        setBulkLoading(false);
        return;
      }
      setLastAction({ ids: targetIds, previousStates, action });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      if (!ids) setSelectedIds(new Set());
      toast.success(
        `${targetIds.length} hub(s) ${action === 'delete' ? 'deleted' : action === 'activate' ? 'activated' : 'deactivated'}`
      );
      fetchHubs();
    } catch (err) {
      logger.error('Bulk action failed', { error: err });
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
          fetch('/api/admin/hubs', {
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
      fetchHubs();
    } catch (err) {
      logger.error('Undo failed', { error: err });
      toast.error('Undo failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hubs</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage pickup and fleet hub locations
          </p>
        </div>
        <Button onClick={() => openDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Hub
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, location, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl border-muted-foreground/20"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="ALL" className="rounded-lg text-xs font-bold uppercase h-8 px-3">
              All
            </TabsTrigger>
            <TabsTrigger value="ACTIVE" className="rounded-lg text-xs font-bold uppercase h-8 px-3">
              Active
            </TabsTrigger>
            <TabsTrigger
              value="INACTIVE"
              className="rounded-lg text-xs font-bold uppercase h-8 px-3"
            >
              Inactive
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
                const header =
                  esc('Name') +
                  ',' +
                  esc('Location') +
                  ',' +
                  esc('City') +
                  ',' +
                  esc('Status') +
                  ',' +
                  esc('Vehicles') +
                  ',' +
                  esc('Created');
                const rows = hubs
                  .filter((h) => selectedIds.has(h.id))
                  .map((h) =>
                    [
                      esc(h.name),
                      esc(h.location || ''),
                      esc(h.city || ''),
                      esc(h.isActive ? 'Active' : 'Inactive'),
                      esc(String(h._count?.vehicles ?? 0)),
                      esc(h.createdAt),
                    ].join(',')
                  );
                const csv = [header, ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `hubs-${new Date().toISOString().split('T')[0]}.csv`);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">{search ? 'No hubs match your search' : 'No hubs added yet'}</p>
        </div>
      ) : (
        <div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <Checkbox
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onCheckedChange={(checked) =>
                  setSelectedIds(checked ? new Set(filtered.map((h) => h.id)) : new Set())
                }
              />
              <span className="text-xs text-muted-foreground">Select All ({filtered.length})</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((hub) => (
              <Card
                key={hub.id}
                className={
                  selectedIds.has(hub.id) ? 'ring-2 ring-primary/30 bg-primary/[0.02]' : ''
                }
              >
                <CardHeader className="pt-5 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedIds.has(hub.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(hub.id);
                          else next.delete(hub.id);
                          setSelectedIds(next);
                        }}
                      />
                      <div
                        className={`p-2 rounded-full bg-amber-500/10 ${!hub.isActive ? 'opacity-40' : ''}`}
                      >
                        <Building2
                          className={`h-6 w-6 ${hub.isActive ? 'text-amber-600' : 'text-muted-foreground'}`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base leading-tight pb-1">{hub.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`mt-1 text-[10px] font-bold ${
                            hub.isActive
                              ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                              : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                          }`}
                        >
                          {hub.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-5">
                  <div className="space-y-2 text-sm">
                    {hub.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{hub.location}</span>
                        {hub.city && <span className="text-xs opacity-60">({hub.city})</span>}
                      </div>
                    )}
                    {hub.city && !hub.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{hub.city}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Bike className="h-3.5 w-3.5" />
                      <span>
                        {hub._count?.vehicles ?? 0} vehicle
                        {(hub._count?.vehicles ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {hub.vehicleBreakdown && (
                      <div className="mt-3 pt-3 border-t border-muted/30 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Available</span>
                          <span className="font-bold text-sm">
                            {hub.vehicleBreakdown.available}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          <span>Assigned</span>
                          <span className="font-bold text-sm">{hub.vehicleBreakdown.assigned}</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                          <span>Maintenance</span>
                          <span className="font-bold text-sm">
                            {hub.vehicleBreakdown.maintenance}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-500/5 border border-slate-500/10 text-slate-600 dark:text-slate-400 font-medium">
                          <span>Retired</span>
                          <span className="font-bold text-sm">{hub.vehicleBreakdown.retired}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Created: {formatDate(hub.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                      variant={hub.isActive ? 'outline' : 'default'}
                      size="sm"
                      disabled={toggleLoading === hub.id}
                      onClick={() => toggleActive(hub)}
                    >
                      {toggleLoading === hub.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : null}
                      {hub.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Edit hub"
                        onClick={() => openDialog(hub)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        aria-label="Delete hub"
                        onClick={() => setDeleteTarget(hub.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editHub ? 'Edit' : 'Add'} Hub</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Hub Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sector 7, Downtown"
              />
            </div>
            <div className="space-y-2">
              <Label>Location / Address</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Full address (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Bengaluru (optional)"
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
            <Button onClick={saveHub} disabled={!form.name || saving}>
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
            <AlertDialogTitle>Delete Hub</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? If vehicles are assigned to this hub, deletion will be blocked until
              they are reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
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
            <AlertDialogTitle>Delete {bulkDeleteTargets?.length || 0} Hubs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {bulkDeleteTargets?.length || 0} hub(s)? Hubs with
              assigned vehicles will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showUndoToast && lastAction && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <span className="text-sm">{lastAction.ids.length} hub(s) updated</span>
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
    </div>
  );
}
