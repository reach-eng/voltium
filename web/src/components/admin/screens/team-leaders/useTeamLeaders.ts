'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  EMPTY_LEADER_FORM,
  TEAM_LEADER_PAGE_SIZE,
  type TeamLeader,
  type TeamLeaderFormState,
  type TeamLeaderStatsPayload,
} from './types';

/**
 * R3.7aa split — Team Leader Management data hook.
 *
 * Owns: paginated list (debounced search + active filter), selection
 * set, form state, the bulk-action undo stack, last-action snapshot,
 * the create/update/delete/toggle/bulk handlers, and the
 * mountedRef race-condition guard.
 */
export function useTeamLeaders() {
  const [leaders, setLeaders] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLeader, setEditLeader] = useState<TeamLeader | null>(null);
  const [form, setForm] = useState<TeamLeaderFormState>({ ...EMPTY_LEADER_FORM });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<{
    ids: string[];
    previousStates: Record<string, { isActive: boolean }>;
    action: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<string[] | null>(null);

  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedTlStats, setSelectedTlStats] = useState<TeamLeaderStatsPayload | null>(null);

  const mountedRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search → 500ms; reset page on each keystroke
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchLeaders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(TEAM_LEADER_PAGE_SIZE));
      if (search) params.set('search', search);
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
  }, [page, search, activeFilter]);

  useEffect(() => {
    mountedRef.current = true;
    fetchLeaders();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchLeaders]);

  const openCreate = useCallback(() => {
    setEditLeader(null);
    setForm({ ...EMPTY_LEADER_FORM });
    setError(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((leader: TeamLeader) => {
    setEditLeader(leader);
    setForm({
      name: leader.name,
      phone: leader.phone,
      email: leader.email || '',
      isActive: leader.isActive,
    });
    setError(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditLeader(null);
  }, []);

  const saveLeader = useCallback(async () => {
    if (!form.name.trim() || form.phone.trim().length !== 10) {
      setError('Please provide a valid name and 10-digit phone number');
      return;
    }
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
      setForm({ ...EMPTY_LEADER_FORM });
      setEditLeader(null);
      fetchLeaders();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Network error. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }, [editLeader, form, fetchLeaders]);

  const toggleActive = useCallback(
    async (leader: TeamLeader) => {
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
    },
    [fetchLeaders]
  );

  const confirmDeleteLeader = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/admin/team-leaders', {
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
  }, [deleteTarget, fetchLeaders]);

  const handleBulkAction = useCallback(
    async (action: string) => {
      if (selectedIds.size === 0) return false;
      const previousStates: Record<string, { isActive: boolean }> = {};
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
          return false;
        }
        toast.success(
          `Bulk ${action} completed on ${selectedIds.size} team leader(s)`
        );
        setLastAction({ ids: Array.from(selectedIds), previousStates, action });
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
        setSelectedIds(new Set());
        fetchLeaders();
        return true;
      } catch {
        toast.error('Bulk action failed. Please try again.');
        return false;
      } finally {
        setBulkLoading(false);
      }
    },
    [selectedIds, leaders, fetchLeaders]
  );

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const items = Object.entries(lastAction.previousStates).map(([id, prev]) => ({
        id,
        isActive: prev.isActive,
      }));
      const res = await fetch('/api/admin/team-leaders/bulk/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Undo failed');
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
  }, [lastAction, fetchLeaders]);

  const confirmBulkDelete = useCallback(async () => {
    if (!bulkDeleteTargets || bulkDeleteTargets.length === 0) return;
    const success = await handleBulkAction('delete');
    if (success) {
      setBulkDeleteTargets(null);
    }
  }, [bulkDeleteTargets, handleBulkAction]);

  const viewStats = useCallback(async (leader: TeamLeader) => {
    setStatsModalOpen(true);
    setStatsLoading(true);
    setSelectedTlStats(null);
    try {
      const res = await fetch(`/api/admin/team-leaders/${leader.id}/riders`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSelectedTlStats({ leader, data: json.data });
        }
      }
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(leaders.map((l) => l.id)));
  }, [leaders]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  return {
    // data
    leaders,
    loading,
    // filters
    search,
    setSearch,
    activeFilter,
    setActiveFilter,
    page,
    setPage,
    totalPages,
    totalCount,
    // form
    form,
    setForm,
    dialogOpen,
    closeDialog,
    editLeader,
    openCreate,
    openEdit,
    saveLeader,
    saving,
    error,
    // single-row ops
    toggleActive,
    toggleLoading,
    deleteTarget,
    setDeleteTarget,
    confirmDeleteLeader,
    // bulk + undo
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    bulkLoading,
    handleBulkAction,
    handleUndo,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    bulkDeleteTargets,
    setBulkDeleteTargets,
    confirmBulkDelete,
    // stats
    statsModalOpen,
    setStatsModalOpen,
    statsLoading,
    selectedTlStats,
    viewStats,
    // revalidation
    fetchLeaders,
  };
}

export type TeamLeadersHook = ReturnType<typeof useTeamLeaders>;
