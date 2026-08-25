'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import type { Vehicle, Hub, VehicleFormData } from './types';
import { DEFAULT_FORM } from './types';

export interface LastBulkAction {
  ids: string[];
  previousStates: Record<string, { status: string; hubId: string }>;
  action: string;
}

export interface VehicleFilters {
  search: string;
  statusFilter: string;
}

export interface BulkDialogs {
  statusOpen: boolean;
  hubOpen: boolean;
  deleteOpen: boolean;
  statusValue: string;
  hubValue: string;
}

/**
 * R3.7e split — Vehicle management data hook.
 *
 * Owns the 18-state machine (vehicles, hubs, loading, dialogs, form,
 * selection, undo, pagination) plus the network handlers (fetch,
 * add, edit, delete, bulk). Extracted from VehicleManagement.tsx so the
 * shell can be a pure renderer.
 */
export function useVehicleManagement() {
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
  const [form, setForm] = useState<VehicleFormData>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<LastBulkAction | null>(null);
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
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', '20');
      if (search) params.set('search', search);
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/vehicles?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        const vList = Array.isArray(data.vehicles)
          ? data.vehicles
          : Array.isArray(json.data)
            ? json.data
            : [];
        const hList = Array.isArray(data.hubs)
          ? data.hubs
          : Array.isArray(json.hubs)
            ? json.hubs
            : [];
        setVehicles(vList);
        setHubs(hList);
        setTotalPages(json.pagination?.totalPages || data.pagination?.totalPages || 1);
      }
    } catch (err) {
      logger.error('Failed to fetch vehicles', { error: err });
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter]);

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

  const openHistory = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setHistoryOpen(true);
    fetchVehicleHistory(vehicle.id);
  };

  const handleAddVehicle = async () => {
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
        setForm({ ...DEFAULT_FORM });
        fetchVehicles();
      } else {
        const json = await res.json().catch(() => ({}));
        setAddEditError(json.message || 'Failed to add vehicle');
      }
    } catch (err) {
      setAddEditError('Something went wrong');
      logger.error('Failed to add vehicle', { error: err });
    }
  };

  const openEdit = (vehicle: Vehicle) => {
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
  };

  const handleEditVehicle = async () => {
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
        setForm({ ...DEFAULT_FORM });
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
  };

  const handleDeleteVehicle = async () => {
    if (!deleteConfirm) return;
    try {
      await fetch(`/api/admin/vehicles?id=${deleteConfirm}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      fetchVehicles();
    } catch (err) {
      logger.error('Failed to delete vehicle', { error: err });
    }
  };

  const handleBulkAction = async (action: string, value?: string) => {
    if (selectedIds.size === 0) return;
    const previousStates: Record<string, { status: string; hubId: string }> = {};
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
  };

  const handleUndo = async () => {
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
  };

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

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return {
    // data
    vehicles,
    hubs,
    filtered,
    loading,
    totalPages,
    currentPage,
    setCurrentPage,
    // vehicle detail
    selectedVehicle,
    vehicleHistory,
    historyLoading,
    historyOpen,
    setHistoryOpen,
    openHistory,
    // form (add/edit)
    form,
    setForm,
    saving,
    addEditError,
    setAddEditError,
    addOpen,
    setAddOpen,
    editOpen,
    setEditOpen,
    handleAddVehicle,
    openEdit,
    handleEditVehicle,
    // delete
    deleteConfirm,
    setDeleteConfirm,
    handleDeleteVehicle,
    // filters
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    // selection
    selectedIds,
    setSelectedIds,
    handleToggleSelect,
    // bulk actions + undo
    bulkLoading,
    handleBulkAction,
    handleUndo,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    bulkStatusDialog,
    setBulkStatusDialog,
    bulkHubDialog,
    setBulkHubDialog,
    bulkStatusValue,
    setBulkStatusValue,
    bulkHubValue,
    setBulkHubValue,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    // revalidation
    fetchVehicles,
  };
}

export type VehicleManagementHook = ReturnType<typeof useVehicleManagement>;
