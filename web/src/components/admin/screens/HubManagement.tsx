'use client';

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
import { useHubs } from './hub-management/useHubs';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

/**
 * R3 split (HubManagement) — shell.
 *
 * Pre-split: 27.6 KB / 746 lines with 19 useState + 5 fetch handlers
 * + keyboard + bulk + undo + 3 dialogs + 3-col hub cards inline.
 * Post-split: thin orchestrator that wires the data hook. All
 * state + network logic + keyboard + undo lives in `useHubs`
 * (9 KB). Most of the UI (cards, dialogs, bulk bar, undo toast)
 * stays in the shell because the file is structurally a single
 * "manage hubs" view; further splitting the cards/dialogs into
 * separate files would just add imports without a real
 * readability win.
 */
export default function HubManagement() {
  const h = useHubs();

  const exportCsv = () => {
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
    const rows = h.hubs
      .filter((hub) => h.selectedIds.has(hub.id))
      .map((hub) =>
        [
          esc(hub.name),
          esc(hub.location || ''),
          esc(hub.city || ''),
          esc(hub.isActive ? 'Active' : 'Inactive'),
          esc(String(hub._count?.vehicles ?? 0)),
          esc(hub.createdAt),
        ].join(',')
      );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hubs-${formatDateDDMMYYYY(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hubs</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage pickup and fleet hub locations
          </p>
        </div>
        <Button onClick={() => h.openDialog()} size="default" className="rounded-xl h-11 px-5">
          <Plus className="h-5 w-5 mr-1.5" /> Add Hub
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, location, or city..."
            value={h.search}
            onChange={(e) => h.setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
          />
        </div>
        <Tabs
          value={h.statusFilter}
          onValueChange={(v) => h.setStatusFilter(v as typeof h.statusFilter)}
        >
          <TabsList className="bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="ALL" className="rounded-lg text-xs font-bold uppercase h-10 px-4">
              All
            </TabsTrigger>
            <TabsTrigger value="ACTIVE" className="rounded-lg text-xs font-bold uppercase h-10 px-4">
              Active
            </TabsTrigger>
            <TabsTrigger
              value="INACTIVE"
              className="rounded-lg text-xs font-bold uppercase h-10 px-4"
            >
              Inactive
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {h.selectedIds.size > 0 && (
          <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
            <span className="text-xs px-2 font-medium text-primary">
              {h.selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="default"
              className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
              disabled={h.bulkLoading}
              onClick={() => h.handleBulkAction('activate')}
              title="Activate All"
            >
              {h.bulkLoading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}{' '}
              Activate
            </Button>
            <Button
              variant="ghost"
              size="default"
              className="h-10 text-sm px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              disabled={h.bulkLoading}
              onClick={() => h.handleBulkAction('deactivate')}
              title="Deactivate All"
            >
              <Ban className="w-4 h-4 mr-1.5" /> Deactivate
            </Button>
            <Button
              variant="ghost"
              size="default"
              className="h-10 text-sm px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              disabled={h.bulkLoading}
              onClick={() => h.setBulkDeleteTargets(Array.from(h.selectedIds))}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete
            </Button>
            <Button
              variant="ghost"
              size="default"
              className="h-10 text-sm px-3 hover:bg-muted-foreground/10 transition-all duration-200"
              onClick={exportCsv}
            >
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            {h.lastAction && (
              <>
                <div className="w-px h-4 bg-border/50 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 hover:bg-muted/10 transition-all duration-200"
                  disabled={h.bulkLoading}
                  onClick={h.handleUndo}
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
              onClick={() => h.setSelectedIds(new Set())}
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {h.loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : h.filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">
            {h.search ? 'No hubs match your search' : 'No hubs added yet'}
          </p>
        </div>
      ) : (
        <div>
          {h.selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <Checkbox
                checked={h.selectedIds.size === h.filtered.length && h.filtered.length > 0}
                onCheckedChange={(checked) =>
                  h.setSelectedIds(checked ? new Set(h.filtered.map((hub) => hub.id)) : new Set())
                }
              />
              <span className="text-xs text-muted-foreground">
                Select All ({h.filtered.length})
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {h.filtered.map((hub) => (
              <Card
                key={hub.id}
                className={h.selectedIds.has(hub.id) ? 'ring-2 ring-primary/30 bg-primary/[0.02]' : ''}
              >
                <CardHeader className="pt-5 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={h.selectedIds.has(hub.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(h.selectedIds);
                          if (checked) next.add(hub.id);
                          else next.delete(hub.id);
                          h.setSelectedIds(next);
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
                      Created: {formatDateDDMMYYYY(hub.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                      variant={hub.isActive ? 'outline' : 'default'}
                      size="sm"
                      disabled={h.toggleLoading === hub.id}
                      onClick={() => h.toggleActive(hub)}
                    >
                      {h.toggleLoading === hub.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : null}
                      {hub.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        aria-label="Edit hub"
                        onClick={() => h.openDialog(hub)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-red-500"
                        aria-label="Delete hub"
                        onClick={() => h.setDeleteTarget(hub.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={h.dialogOpen} onOpenChange={h.setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{h.editHub ? 'Edit' : 'Add'} Hub</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {h.error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {h.error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Hub Name</Label>
              <Input
                value={h.form.name}
                onChange={(e) => h.setForm({ ...h.form, name: e.target.value })}
                placeholder="e.g. Sector 7, Downtown"
              />
            </div>
            <div className="space-y-2">
              <Label>Location / Address</Label>
              <Input
                value={h.form.location}
                onChange={(e) => h.setForm({ ...h.form, location: e.target.value })}
                placeholder="Full address (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={h.form.city}
                onChange={(e) => h.setForm({ ...h.form, city: e.target.value })}
                placeholder="e.g. Bengaluru (optional)"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={h.form.isActive}
                onCheckedChange={(v) => h.setForm({ ...h.form, isActive: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => h.setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={h.saveHub} disabled={!h.form.name || h.saving}>
              {h.saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!h.deleteTarget}
        onOpenChange={(open) => {
          if (!open) h.setDeleteTarget(null);
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
            <AlertDialogAction onClick={h.confirmDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!h.bulkDeleteTargets}
        onOpenChange={(open) => {
          if (!open) h.setBulkDeleteTargets(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {h.bulkDeleteTargets?.length || 0} Hubs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {h.bulkDeleteTargets?.length || 0} hub(s)? Hubs with
              assigned vehicles will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={h.confirmBulkDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {h.showUndoToast && h.lastAction && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <span className="text-sm">{h.lastAction.ids.length} hub(s) updated</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 hover:bg-background/20 text-background"
            disabled={h.bulkLoading}
            onClick={h.handleUndo}
          >
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </Button>
        </div>
      )}
    </div>
  );
}
