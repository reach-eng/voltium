'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Ban,
  Download,
  X,
  Undo2,
  Loader2,
} from 'lucide-react';
import { AdminErrorBoundary } from '../error-boundary';
import { useHubs, HubGrid } from './hub-management';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

/**
 * HubManagement — Main coordinator screen shell.
 * Delegates state management to useHubs() and layout rendering
 * to modular components under ./hub-management/
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
        ].join(','),
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
    <AdminErrorBoundary>
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

        <HubGrid
          loading={h.loading}
          hubs={h.filtered}
          search={h.search}
          selectedIds={h.selectedIds}
          setSelectedIds={h.setSelectedIds}
          toggleLoading={h.toggleLoading}
          onToggleActive={h.toggleActive}
          onEdit={h.openDialog}
          onDelete={(id) => h.setDeleteTarget(id)}
        />

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
    </AdminErrorBoundary>
  );
}
