'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  EMPTY_HUB_FORM,
  type Hub,
  type HubForm,
  type LastHubBulkAction,
  type StatusFilter,
} from './types';

/**
 * R3 split (HubManagement) — data hook.
 *
 * Owns the 19-state machine (list, form, dialogs, selection,
 * bulk, undo, last action) plus the network handlers
 * (fetch, save, delete, toggle, bulk). The local `filtered`
 * array applies the search + status filter on the client.
 */
export function useHubs() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editHub, setEditHub] = useState<Hub | null>(null);
  const [form, setForm] = useState<HubForm>({ ...EMPTY_HUB_FORM });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<LastHubBulkAction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<string[] | null>(null);
  const mountedRef = useRef(true);

  const fetchHubs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/hubs?limit=100');
      if (!mountedRef.current) return;
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setHubs(json.data || []);
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
      setForm({ ...EMPTY_HUB_FORM });
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
      setForm({ ...EMPTY_HUB_FORM });
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

  // Keyboard shortcuts: Ctrl+A select-all, Ctrl+Z undo
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

  const handleBulkAction = async (action: string, ids?: string[]) => {
    const targetIds = ids || Array.from(selectedIds);
    if (targetIds.length === 0) return;
    const previousStates: LastHubBulkAction['previousStates'] = {};
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
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const promises = lastAction.ids.map((id) =>
        fetch('/api/admin/hubs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, isActive: lastAction.previousStates[id]?.isActive }),
        })
      );
      await Promise.all(promises);
      setLastAction(null);
      setShowUndoToast(false);
      fetchHubs();
    } catch {
      toast.error('Undo failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  return {
    // data
    hubs,
    filtered,
    loading,
    // filters
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    // form
    dialogOpen,
    setDialogOpen,
    editHub,
    form,
    setForm,
    openDialog,
    saveHub,
    saving,
    error,
    // delete
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    bulkDeleteTargets,
    setBulkDeleteTargets,
    confirmBulkDelete,
    // selection
    selectedIds,
    setSelectedIds,
    // bulk
    bulkLoading,
    handleBulkAction,
    handleUndo,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    // per-row
    toggleActive,
    toggleLoading,
    // revalidation
    fetchHubs,
  };
}

export type HubsHook = ReturnType<typeof useHubs>;
