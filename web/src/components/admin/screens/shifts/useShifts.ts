'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';
import type { Shift, ShiftForm, ShiftPart } from './types';
import { EMPTY_SHIFT_FORM } from './types';

/**
 * R3.7g split — Shifts data hook.
 *
 * Owns the shift list, the open/edit form state, the dialog
 * visibility, and the network handlers (save / delete / toggle).
 * Exposes a small, focused surface to the orchestrator.
 */
export function useShifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [form, setForm] = useState<ShiftForm>({ ...EMPTY_SHIFT_FORM });
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
      setForm({ ...EMPTY_SHIFT_FORM });
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
      setForm({ ...EMPTY_SHIFT_FORM });
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

  return {
    // data
    shifts,
    loading,
    // filters
    search,
    setSearch,
    activeFilter,
    setActiveFilter,
    // form
    dialogOpen,
    setDialogOpen,
    editShift,
    form,
    setForm,
    updatePart,
    addPart,
    removePart,
    saving,
    error,
    openDialog,
    saveShift,
    // delete
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    // toggle
    toggleActive,
  };
}

export type ShiftsHook = ReturnType<typeof useShifts>;
