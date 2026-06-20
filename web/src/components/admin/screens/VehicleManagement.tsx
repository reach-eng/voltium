'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Bike,
  Plus,
  MapPin,
  Battery,
  Download,
  Edit,
  Trash2,
  Eye,
  History,
  Camera,
  Ticket,
  User,
  Calendar,
  AlertCircle,
  Search,
  CheckCircle2,
  Ban,
  X,
  Undo2,
  Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExportButton } from '../export-button';
import { AdminErrorBoundary } from '../error-boundary';
import { logger } from '@/lib/logger';

interface Vehicle {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  model: string;
  licensePlate: string | null;
  batteryPartner: string | null;
  status: string;
  hubId: string;
  hub?: { name: string; city: string | null };
  batteryLevel: number;
  createdAt: string;
  returns?: any[];
  leases?: any[];
}

interface Hub {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  AVAILABLE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  ASSIGNED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  RENTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  MAINTENANCE: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  LOST: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  RETIRED: 'border-border text-muted-foreground bg-muted/30',
};

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleHistory, setVehicleHistory] = useState<{
    leases: any[];
    tickets: any[];
    returns: any[];
  }>({ leases: [], tickets: [], returns: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    vehicleNumber: '',
    model: '',
    batteryPartner: 'Battery Smart',
    licensePlate: '',
    hubId: '',
    status: 'AVAILABLE',
  });
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<{
    ids: string[];
    previousStates: Record<string, any>;
    action: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [bulkStatusDialog, setBulkStatusDialog] = useState(false);
  const [bulkHubDialog, setBulkHubDialog] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkHubValue, setBulkHubValue] = useState('');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [addEditError, setAddEditError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const mountedRef = useRef(true);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vehicles?page=${currentPage}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        // API now returns { data: { vehicles, hubs }, pagination }
        const data = json.data || {};
        setVehicles(data.vehicles || json.data || []);
        setHubs(data.hubs || json.hubs || []);
        setTotalPages(json.pagination?.totalPages || 1);
      }
    } catch (err) {
      logger.error('Failed to fetch vehicles', { error: err });
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, search]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchVehicleHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/vehicles/${id}/history`);
      if (res.ok) {
        const json = await res.json();
        setVehicleHistory(json.data);
      }
    } catch (err) {
      logger.error('Failed to fetch vehicle history', { error: err });
    } finally {
      setHistoryLoading(false);
    }
  };

  function openHistory(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setHistoryOpen(true);
    fetchVehicleHistory(vehicle.id);
  }

  async function handleAddVehicle() {
    if (!form.vehicleNumber || !form.model || !form.hubId) return;
    setAddEditError('');
    try {
      const res = await fetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setAddOpen(false);
        setForm({
          vehicleNumber: '',
          model: '',
          batteryPartner: 'Battery Smart',
          licensePlate: '',
          hubId: '',
          status: 'AVAILABLE',
        });
        fetchVehicles();
      } else {
        const json = await res.json().catch(() => ({}));
        setAddEditError(json.message || 'Failed to add vehicle');
      }
    } catch (err) {
      setAddEditError('Something went wrong');
      logger.error('Failed to add vehicle', { error: err });
    }
  }

  function openEdit(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setForm({
      vehicleNumber: vehicle.vehicleNumber,
      model: vehicle.model,
      batteryPartner: vehicle.batteryPartner || 'Battery Smart',
      licensePlate: vehicle.licensePlate || '',
      hubId: vehicle.hubId,
      status: vehicle.status,
    });
    setEditOpen(true);
  }

  async function handleEditVehicle() {
    if (!selectedVehicle || !form.vehicleNumber || !form.model || !form.hubId) return;
    setSaving(true);
    setAddEditError('');
    try {
      const res = await fetch('/api/admin/vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedVehicle.id, ...form }),
      });
      if (res.ok) {
        setEditOpen(false);
        setSelectedVehicle(null);
        setForm({
          vehicleNumber: '',
          model: '',
          batteryPartner: 'Battery Smart',
          licensePlate: '',
          hubId: '',
          status: 'AVAILABLE',
        });
        fetchVehicles();
      } else {
        const json = await res.json().catch(() => ({}));
        setAddEditError(json.message || 'Failed to update vehicle');
      }
    } catch (err) {
      setAddEditError('Something went wrong');
      logger.error('Failed to update vehicle', { error: err });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVehicle() {
    if (!deleteConfirm) return;
    try {
      await fetch(`/api/admin/vehicles?id=${deleteConfirm}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      fetchVehicles();
    } catch (err) {
      logger.error('Failed to delete vehicle', { error: err });
    }
  }

  async function handleBulkAction(action: string, value?: string) {
    if (selectedIds.size === 0) return;
    const previousStates: Record<string, any> = {};
    vehicles
      .filter((v) => selectedIds.has(v.id))
      .forEach((v) => {
        previousStates[v.id] = { status: v.status, hubId: v.hubId };
      });
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/vehicles/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, value }),
      });
      if (res.ok) {
        setLastAction({ ids: Array.from(selectedIds), previousStates, action: value || action });
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
        setSelectedIds(new Set());
        fetchVehicles();
      }
    } catch (err) {
      logger.error('Bulk action failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleUndo() {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const promises = Object.entries(lastAction.previousStates).map(([id, prev]) =>
        fetch('/api/admin/vehicles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: prev.status, hubId: prev.hubId }),
        })
      );
      await Promise.all(promises);
      setLastAction(null);
      setShowUndoToast(false);
      fetchVehicles();
    } catch (err) {
      logger.error('Undo failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  }

  const filtered = vehicles.filter((v) => {
    if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
    if (
      search &&
      !v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) &&
      !v.model.toLowerCase().includes(search.toLowerCase()) &&
      !v.vehicleId.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(filtered.map((v) => v.id)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, lastAction, bulkLoading]);

  const STATUS_FILTERS = ['ALL', 'AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'RETIRED'];

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <ExportButton
              data={filtered.map((v) => ({
                vehicleId: v.vehicleId,
                vehicleNumber: v.vehicleNumber,
                model: v.model,
                licensePlate: v.licensePlate || '',
                status: v.status,
                hubName: v.hub?.name,
                batteryLevel: v.batteryLevel,
                batteryPartner: v.batteryPartner,
                createdAt: v.createdAt,
              }))}
              filename="vehicles"
              columns={[
                { key: 'vehicleId', label: 'Vehicle ID' },
                { key: 'vehicleNumber', label: 'Vehicle Number' },
                { key: 'model', label: 'Model' },
                { key: 'licensePlate', label: 'License Plate' },
                { key: 'status', label: 'Status' },
                { key: 'hubName', label: 'Hub' },
                { key: 'batteryLevel', label: 'Battery Level' },
                { key: 'batteryPartner', label: 'Battery Partner' },
                { key: 'createdAt', label: 'Created At' },
              ]}
            />
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by number, model, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl border-muted-foreground/20"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-muted/30 p-1 rounded-xl">
              {STATUS_FILTERS.map((s) => {
                const count =
                  s === 'ALL' ? vehicles.length : vehicles.filter((v) => v.status === s).length;
                return (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="rounded-lg text-xs font-bold uppercase h-8 px-3"
                  >
                    {s.replace('_', ' ')} {count > 0 && `(${count})`}
                  </TabsTrigger>
                );
              })}
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
                onClick={() => setBulkStatusDialog(true)}
                title="Change Status"
              >
                {bulkLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                )}{' '}
                Status
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                disabled={bulkLoading}
                onClick={() => setBulkHubDialog(true)}
                title="Reassign Hub"
              >
                <MapPin className="w-3 h-3 mr-1" /> Hub
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                disabled={bulkLoading}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-muted-foreground/10 transition-all duration-200"
                onClick={() => {
                  const header = 'Vehicle ID,Number,Model,Status,Hub,Battery';
                  const rows = vehicles
                    .filter((v) => selectedIds.has(v.id))
                    .map((v) =>
                      [
                        v.vehicleId,
                        v.vehicleNumber,
                        v.model,
                        v.status,
                        v.hub?.name || '',
                        v.batteryLevel,
                      ].join(',')
                    );
                  const csv = [header, ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute(
                    'download',
                    `vehicles-${new Date().toISOString().split('T')[0]}.csv`
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
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Card className="rounded-xl shadow-sm overflow-x-auto border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-muted/30">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onCheckedChange={(checked) =>
                        setSelectedIds(checked ? new Set(filtered.map((v) => v.id)) : new Set())
                      }
                    />
                  </TableHead>
                  <TableHead>Vehicle Info</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Latest Return Photo</TableHead>
                  <TableHead>Current Rider</TableHead>
                  <TableHead>Hub</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                      {search || statusFilter !== 'ALL'
                        ? 'No vehicles match your filters'
                        : 'No vehicles in fleet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((vehicle) => {
                    const latestReturn = vehicle.returns?.[0];
                    const activeLease = vehicle.leases?.[0];

                    return (
                      <TableRow
                        key={vehicle.id}
                        className={`hover:bg-muted/30 transition-colors ${selectedIds.has(vehicle.id) ? 'bg-primary/5' : ''}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(vehicle.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedIds);
                              if (checked) next.add(vehicle.id);
                              else next.delete(vehicle.id);
                              setSelectedIds(next);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-black text-sm">{vehicle.vehicleNumber}</p>
                            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">
                              {vehicle.vehicleId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{vehicle.model}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Battery className="w-3.5 h-3.5" />
                            {vehicle.batteryLevel != null ? `${vehicle.batteryLevel}%` : '—'}
                          </div>
                          {vehicle.batteryPartner && (
                            <p className="text-[10px] text-muted-foreground">
                              {vehicle.batteryPartner}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {latestReturn?.photoFront ? (
                            <div className="w-12 h-12 rounded-lg border bg-muted overflow-hidden relative group/img">
                              <img
                                src={latestReturn.photoFront}
                                alt="Return"
                                className="w-full h-full object-cover transition-transform group-hover/img:scale-125"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground opacity-30">
                              <Camera className="w-4 h-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {activeLease ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold text-blue-600">
                                {activeLease.rider.fullName}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase">
                                {activeLease.rider.riderId}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {vehicle.hub ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              {vehicle.hub.name}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-black uppercase tracking-widest ${statusColors[vehicle.status] || ''}`}
                          >
                            {vehicle.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openHistory(vehicle)}
                              title="View History"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEdit(vehicle)}
                              title="Edit Vehicle"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                              onClick={() => setDeleteConfirm(vehicle.id)}
                              title="Delete Vehicle"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl">
            <DialogHeader className="px-8 pt-8 pb-4 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Bike className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight">
                    {selectedVehicle?.vehicleNumber}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedVehicle?.vehicleId} • {selectedVehicle?.model}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar">
              <Tabs defaultValue="history" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8 bg-muted/30 p-1 rounded-2xl h-12">
                  <TabsTrigger value="history" className="rounded-xl">
                    Ride History
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="rounded-xl">
                    Service Tickets
                  </TabsTrigger>
                  <TabsTrigger value="inspection" className="rounded-xl">
                    Latest Inspection
                  </TabsTrigger>
                </TabsList>

                {/* Ride History */}
                <TabsContent value="history" className="space-y-4 animate-in fade-in duration-300">
                  {historyLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : vehicleHistory.leases.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <User className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-medium">No ride history found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {vehicleHistory.leases.map((lease) => (
                        <div
                          key={lease.id}
                          className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-muted/30"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold">
                              {lease.rider.fullName[0]}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{lease.rider.fullName}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">
                                {lease.rider.riderId}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold">
                              {new Date(lease.leaseDate).toLocaleDateString()}
                            </p>
                            <Badge
                              variant="outline"
                              className="text-[8px] uppercase tracking-widest bg-blue-500/5 text-blue-600"
                            >
                              {lease.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Service Tickets */}
                <TabsContent value="tickets" className="space-y-4 animate-in fade-in duration-300">
                  {historyLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : vehicleHistory.tickets.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Ticket className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-medium">No service tickets for this vehicle</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {vehicleHistory.tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-4 rounded-2xl bg-muted/20 border border-muted/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge
                              className={`text-[9px] uppercase tracking-widest ${
                                ticket.status === 'OPEN' ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            >
                              {ticket.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {ticket.ticketId}
                            </span>
                          </div>
                          <p className="font-bold text-sm mb-1">{ticket.subject}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>By {ticket.rider.fullName}</span>
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Latest Inspection */}
                <TabsContent
                  value="inspection"
                  className="space-y-6 animate-in fade-in duration-300"
                >
                  {selectedVehicle?.returns?.[0] ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                          <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">
                            Return Date
                          </p>
                          <p className="font-bold">
                            {new Date(selectedVehicle.returns[0].createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/30 border border-muted/50">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Status
                          </p>
                          <Badge className="bg-emerald-500 uppercase text-[9px]">
                            {selectedVehicle.returns[0].status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'Front', key: 'photoFront' },
                          { label: 'Back', key: 'photoBack' },
                          { label: 'Left', key: 'photoLeft' },
                          { label: 'Right', key: 'photoRight' },
                          { label: 'Speedo', key: 'photoSpeedometer' },
                        ].map((photo) => (
                          <div key={photo.key} className="space-y-1 text-center">
                            <div className="aspect-[3/4] rounded-xl border bg-muted overflow-hidden relative group/insp">
                              {selectedVehicle.returns?.[0]?.[photo.key] ? (
                                <>
                                  <img
                                    src={selectedVehicle.returns[0][photo.key]}
                                    alt={photo.label}
                                    className="w-full h-full object-cover transition-transform group-hover/insp:scale-125"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/insp:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-20">
                                  <Camera className="w-6 h-6" />
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                              {photo.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Camera className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-medium">No inspection records available</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="px-8 py-6 bg-muted/20 border-t flex justify-end">
              <Button
                className="rounded-xl h-11 px-8 font-bold"
                onClick={() => setHistoryOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Vehicle Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {addEditError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
                  {addEditError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <Input
                  value={form.vehicleNumber}
                  onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>License Plate</Label>
                <Input
                  value={form.licensePlate}
                  onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hub</Label>
                <Select value={form.hubId} onValueChange={(v) => setForm({ ...form, hubId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No hubs found</div>
                    ) : (
                      hubs.map((hub) => (
                        <SelectItem key={hub.id} value={hub.id}>
                          {hub.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Battery Swapping Partner</Label>
                <Select
                  value={form.batteryPartner}
                  onValueChange={(v) => setForm({ ...form, batteryPartner: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Battery Smart">Battery Smart</SelectItem>
                    <SelectItem value="Sun Mobility">Sun Mobility</SelectItem>
                    <SelectItem value="Gogoro">Gogoro</SelectItem>
                    <SelectItem value="Voltup">Voltup</SelectItem>
                    <SelectItem value="Bounce Infinity">Bounce Infinity</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                    <SelectItem value="RETIRED">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setAddEditError('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditVehicle} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Vehicle Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {addEditError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
                  {addEditError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <Input
                  placeholder="e.g. DL 1AB 1234"
                  value={form.vehicleNumber}
                  onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  placeholder="e.g. Ather 450X"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>License Plate</Label>
                <Input
                  placeholder="e.g. DL 01 AB 1234"
                  value={form.licensePlate}
                  onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hub</Label>
                <Select value={form.hubId} onValueChange={(v) => setForm({ ...form, hubId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No hubs found</div>
                    ) : (
                      hubs.map((hub) => (
                        <SelectItem key={hub.id} value={hub.id}>
                          {hub.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Battery Swapping Partner</Label>
                <Select
                  value={form.batteryPartner}
                  onValueChange={(v) => setForm({ ...form, batteryPartner: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Battery Smart">Battery Smart</SelectItem>
                    <SelectItem value="Sun Mobility">Sun Mobility</SelectItem>
                    <SelectItem value="Gogoro">Gogoro</SelectItem>
                    <SelectItem value="Voltup">Voltup</SelectItem>
                    <SelectItem value="Bounce Infinity">Bounce Infinity</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                    <SelectItem value="RETIRED">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setAddOpen(false);
                  setAddEditError('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddVehicle}
                disabled={!form.vehicleNumber || !form.model || !form.hubId}
              >
                Add Vehicle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deleteConfirm}
          onOpenChange={(o) => {
            if (!o) setDeleteConfirm(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this vehicle? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteVehicle}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedIds.size} Vehicle{selectedIds.size !== 1 ? 's' : ''}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the selected vehicles? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setBulkDeleteOpen(false);
                  handleBulkAction('delete');
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Status Change Dialog */}
        <Dialog open={bulkStatusDialog} onOpenChange={setBulkStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Status for {selectedIds.size} Vehicles</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                    <SelectItem value="RETIRED">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkStatusDialog(false);
                  setBulkStatusValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!bulkStatusValue}
                onClick={() => {
                  handleBulkAction('changeStatus', bulkStatusValue);
                  setBulkStatusDialog(false);
                  setBulkStatusValue('');
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Hub Reassign Dialog */}
        <Dialog open={bulkHubDialog} onOpenChange={setBulkHubDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Hub for {selectedIds.size} Vehicles</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>New Hub</Label>
                <Select value={bulkHubValue} onValueChange={setBulkHubValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.map((hub) => (
                      <SelectItem key={hub.id} value={hub.id}>
                        {hub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkHubDialog(false);
                  setBulkHubValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!bulkHubValue}
                onClick={() => {
                  handleBulkAction('reassignHub', bulkHubValue);
                  setBulkHubDialog(false);
                  setBulkHubValue('');
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showUndoToast && lastAction && (
          <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <span className="text-sm">{lastAction.ids.length} vehicle(s) updated</span>
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
    </AdminErrorBoundary>
  );
}
