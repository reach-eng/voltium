'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Clock, Search, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface ShiftPart {
  startTime: string;
  endTime: string;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  parts?: ShiftPart[];
  maxBookings: number;
  isActive: boolean;
  createdAt: string;
  _count?: { leases: number };
}

export default function ShiftManagement() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [form, setForm] = useState({
    name: '',
    parts: [{ startTime: '', endTime: '' }] as ShiftPart[],
    maxBookings: 5,
    isActive: true,
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeFilter === 'ACTIVE') params.set('active', 'true');
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/shifts?${params}`);
      if (!mountedRef.current) return;
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setShifts(json.data);
    } catch {
      if (!mountedRef.current) return;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [debouncedSearch, activeFilter]);

  useEffect(() => {
    mountedRef.current = true;
    fetchShifts();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchShifts]);

  function openDialog(shift?: Shift) {
    setError(null);
    if (shift) {
      setEditShift(shift);
      if (shift.parts && shift.parts.length > 0) {
        setForm({
          name: shift.name,
          parts: shift.parts.map((p) => ({ ...p })),
          maxBookings: shift.maxBookings,
          isActive: shift.isActive,
        });
      } else {
        // Legacy shift without parts — use startTime/endTime as a single part
        setForm({
          name: shift.name,
          parts: [{ startTime: shift.startTime, endTime: shift.endTime }],
          maxBookings: shift.maxBookings,
          isActive: shift.isActive,
        });
      }
    } else {
      setEditShift(null);
      setForm({
        name: '',
        parts: [{ startTime: '', endTime: '' }],
        maxBookings: 5,
        isActive: true,
      });
    }
    setDialogOpen(true);
  }

  function updatePart(index: number, field: 'startTime' | 'endTime', value: string) {
    const newParts = form.parts.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    setForm({ ...form, parts: newParts });
  }

  function addPart() {
    setForm({ ...form, parts: [...form.parts, { startTime: '', endTime: '' }] });
  }

  function removePart(index: number) {
    if (form.parts.length <= 1) return; // Keep at least one
    setForm({ ...form, parts: form.parts.filter((_, i) => i !== index) });
  }

  const saveShift = async () => {
    if (!form.name.trim()) return;
    const validParts = form.parts.filter((p) => p.startTime && p.endTime);
    if (validParts.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const method = editShift?.id ? 'PUT' : 'POST';
      const body = editShift?.id
        ? {
            id: editShift.id,
            name: form.name,
            parts: validParts,
            maxBookings: form.maxBookings,
            isActive: form.isActive,
          }
        : {
            name: form.name,
            parts: validParts,
            maxBookings: form.maxBookings,
            isActive: form.isActive,
          };

      const res = await fetch('/api/admin/shifts', {
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
      setForm({
        name: '',
        parts: [{ startTime: '', endTime: '' }],
        maxBookings: 5,
        isActive: true,
      });
      setEditShift(null);
      fetchShifts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/admin/shifts', {
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
      toast.success('Shift deleted');
      setDeleteTarget(null);
      fetchShifts();
    } catch {
      toast.error('Network error. Please try again.');
      setDeleteTarget(null);
    }
  };

  const toggleActive = async (shift: Shift) => {
    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shift.id, isActive: !shift.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to toggle shift');
        return;
      }
      toast.success(shift.isActive ? 'Shift deactivated' : 'Shift activated');
      fetchShifts();
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  /** Render the time range(s) for a shift card */
  function renderShiftTimes(shift: Shift) {
    if (shift.parts && shift.parts.length > 1) {
      return (
        <div className="space-y-1">
          {shift.parts.map((part, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Part {i + 1}:</span>
              <span className="font-medium">
                {part.startTime} → {part.endTime}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>
          {shift.startTime} → {shift.endTime}
        </span>
      </div>
    );
  }

  const filtered = shifts; // Server-side filtered now

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Shifts</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage delivery shift slots</p>
        </div>
        <Button onClick={() => openDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Shift
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl border-muted-foreground/20"
          />
        </div>
        <Tabs value={activeFilter} onValueChange={setActiveFilter}>
          <TabsList className="bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="ALL" className="rounded-lg text-xs font-bold uppercase h-8 px-3">
              All
            </TabsTrigger>
            <TabsTrigger value="ACTIVE" className="rounded-lg text-xs font-bold uppercase h-8 px-3">
              Active
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Clock className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">
            {search ? 'No shifts match your search' : 'No shifts added yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((shift) => (
            <Card key={shift.id}>
              <CardHeader className="pt-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${shift.isActive ? 'bg-blue-500/10' : 'bg-muted'}`}
                    >
                      <Clock
                        className={`h-6 w-6 ${shift.isActive ? 'text-blue-600' : 'text-muted-foreground'}`}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base leading-tight pb-1">{shift.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className={`mt-1 text-[10px] font-bold ${
                          shift.isActive
                            ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                            : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                        }`}
                      >
                        {shift.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-5">
                <div className="space-y-2 text-sm">
                  {renderShiftTimes(shift)}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">Max Bookings:</span>
                    <span>{shift.maxBookings}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {shift._count?.leases ?? 0} active lease(s)
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant={shift.isActive ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleActive(shift)}
                  >
                    {shift.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Edit shift"
                      onClick={() => openDialog(shift)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      aria-label="Delete shift"
                      onClick={() => setDeleteTarget(shift.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editShift ? 'Edit' : 'Add'} Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Morning Shift"
              />
            </div>

            {/* Time Parts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Time Ranges</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPart}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Range
                </Button>
              </div>
              {form.parts.map((part, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Part {index + 1} Start</Label>
                    <Input
                      type="time"
                      value={part.startTime}
                      onChange={(e) => updatePart(index, 'startTime', e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Part {index + 1} End</Label>
                    <Input
                      type="time"
                      value={part.endTime}
                      onChange={(e) => updatePart(index, 'endTime', e.target.value)}
                    />
                  </div>
                  {form.parts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePart(index)}
                      className="text-red-500 h-10 w-10 p-0 shrink-0"
                      aria-label={`Remove part ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Max Bookings</Label>
              <Input
                type="number"
                min={1}
                value={form.maxBookings}
                onChange={(e) => setForm({ ...form, maxBookings: parseInt(e.target.value) || 1 })}
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
            <Button
              onClick={saveShift}
              disabled={
                !form.name ||
                form.parts.filter((p) => p.startTime && p.endTime).length === 0 ||
                saving
              }
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? Shifts with active leases cannot be deleted until the leases are
              removed.
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
    </div>
  );
}
