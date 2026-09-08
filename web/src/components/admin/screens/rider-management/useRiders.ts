'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/extract-error';
import { SortDir, SortKey } from './RiderTable';
import {
  RIDER_PAGE_SIZE,
  type ConfirmKycState,
  type KycActionKind,
  type LastBulkAction,
  type Rider,
} from './types';

/**
 * R3.7cc split — Rider Management data hook.
 *
 * Owns the paginated list (debounced search + state + KYC filter +
 * sort), selection, edit form, KYC doc selection, the bulk-action
 * undo stack, and all the PUT/DELETE mutation handlers used by the
 * detail modal.
 */
export function useRiders() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [kycFilter, setKycFilter] = useState('ALL');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedKycDocs, setSelectedKycDocs] = useState<Set<string>>(new Set());
  const [confirmKycAction, setConfirmKycAction] = useState<ConfirmKycState | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState('');
  const [deleteDocKey, setDeleteDocKey] = useState<string | null>(null);
  const [confirmClearGuarantor, setConfirmClearGuarantor] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<LastBulkAction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRider, setNewRider] = useState({ phone: '', fullName: '' });
  const [addingRider, setAddingRider] = useState(false);
  const [showAdjustWallet, setShowAdjustWallet] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRiders = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (stateFilter !== 'ALL') params.set('state', stateFilter);
      if (kycFilter !== 'ALL') params.set('kycStatus', kycFilter);
      params.set('limit', String(RIDER_PAGE_SIZE));
      params.set('page', String(page));
      if (sortKey) {
        params.set('sortBy', String(sortKey));
        params.set('sortDir', sortDir);
      }

      const res = await fetch(`/api/admin/riders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRiders(json.data?.riders || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
      } else {
        const body = await res.json().catch(() => null);
        const message =
          body?.error?.message ||
          body?.message ||
          `Failed to fetch riders (${res.status})`;
        setFetchError(message);
      }
    } catch (err: any) {
      logger.error('Failed to fetch riders', { error: err });
      setFetchError(err?.message || 'Network error fetching riders');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [search, stateFilter, kycFilter, page, sortKey, sortDir]);

  useEffect(() => {
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchRiders();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchRiders]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, stateFilter, kycFilter, sortKey, sortDir]);

  const handleBulkAction = useCallback(
    async (action: string, value?: string) => {
      if (selectedIds.size === 0) return;
      // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): `accountStatus` and
      // `state` are virtual / stripped. Capture `lifecycleStatus`
      // (the real column) so Undo can restore it.
      const previousStates: Record<string, { lifecycleStatus: string }> = {};
      riders
        .filter((r) => selectedIds.has(r.id))
        .forEach((r) => {
          previousStates[r.id] = { lifecycleStatus: r.lifecycleStatus ?? '' };
        });

      setBulkLoading(true);
      try {
        const res = await fetch('/api/admin/riders/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds), action, value }),
        });
        if (res.ok) {
          const body = await res.json().catch(() => null);
          const resultCount = (body?.data?.count as number | undefined) ?? selectedIds.size;
          const failures = (body?.data?.failures as { id: string; error: string }[] | undefined) ?? [];
          setLastAction({
            ids: Array.from(selectedIds),
            previousStates,
            action: value || action,
          });
          setShowUndoToast(true);
          setTimeout(() => setShowUndoToast(false), 5000);
          setSelectedIds(new Set());
          await fetchRiders();
          if (failures.length > 0) {
            // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): surface
            // partial failures. The route already collects
            // per-id errors; tell the admin which ones did
            // not apply.
            toast.warning(
              `Bulk ${action}: ${resultCount - failures.length} of ${resultCount} updated. ${failures.length} failed.`
            );
          } else {
            toast.success(`Bulk ${action}: ${resultCount} updated.`);
          }
        } else {
          // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): the previous
          // `if (res.ok)` branch silently swallowed 4xx/5xx.
          // The audit's "the entire bulk toolbar is dead"
          // finding was hidden behind this. Surface the
          // server's reason.
          const body = await res.json().catch(() => null);
          const message = body?.error?.message || body?.message || `Bulk ${action} failed (${res.status})`;
          toast.error(message);
        }
      } catch (err) {
        logger.error('Bulk action failed', { error: err });
        toast.error(`Bulk ${action} failed`);
      } finally {
        setBulkLoading(false);
      }
    },
    [selectedIds, riders, fetchRiders]
  );

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): Undo PUT
      // `{state, accountStatus}` — both stripped by the
      // schema and absent from the use-case allowlist, so
      // Undo was a no-op even when the original action
      // succeeded. Send `{lifecycleStatus}` instead.
      const promises = Object.entries(lastAction.previousStates).map(([id, prev]) =>
        fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, lifecycleStatus: prev.lifecycleStatus }),
        })
      );
      const results = await Promise.all(promises);
      const allOk = results.every((r) => r.ok);
      setLastAction(null);
      setShowUndoToast(false);
      await fetchRiders();
      if (allOk) {
        toast.success('Bulk action undone.');
      } else {
        toast.warning('Undo completed with some failures. Check the rider list.');
      }
    } catch (err) {
      logger.error('Undo failed', { error: err });
      toast.error('Undo failed');
    } finally {
      setBulkLoading(false);
    }
  }, [lastAction, fetchRiders]);

  const handleUpdateRider = useCallback(async () => {
    if (!selectedRider) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRider.id, ...editForm }),
      });
      if (res.ok) {
        setRiders((prev) =>
          prev.map((r) =>
            r.id === selectedRider.id ? ({ ...r, ...editForm } as Rider) : r
          )
        );
        setSelectedRider((prev) =>
          prev ? ({ ...prev, ...editForm } as Rider) : null
        );
        setIsEditing(false);
        toast.success('Rider updated.');
      } else {
        // ADMIN-RIDER-AUDIT P0-2 (2026-09-08): the previous
        // `if (res.ok)` branch silently swallowed 4xx/5xx.
        // The audit's P0-2e finding (intent: '' and ISO dob
        // both 400'd the server) was hidden behind this. The
        // schema now accepts both shapes; the error toast
        // surfaces any future schema/permission regressions.
        const body = await res.json().catch(() => null);
        const message = body?.error?.message || body?.message || `Update failed (${res.status})`;
        toast.error(message);
      }
    } catch (err) {
      logger.error('Failed to update rider', { error: err });
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  }, [selectedRider, editForm]);

  const handleDeleteKycDoc = useCallback((docKey: string) => {
    setDeleteDocKey(docKey);
  }, []);

  const confirmDeleteKycDoc = useCallback(async () => {
    if (!selectedRider || !deleteDocKey) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRider.id, [deleteDocKey]: null }),
      });
      if (res.ok) {
        setRiders((prev) =>
          prev.map((r) =>
            r.id === selectedRider.id
              ? ({ ...r, [deleteDocKey]: null } as Rider)
              : r
          )
        );
        setSelectedRider((prev) =>
          prev ? ({ ...prev, [deleteDocKey]: null } as Rider) : null
        );
        toast.success('KYC document cleared.');
      } else {
        // ADMIN-RIDER-AUDIT P0-2b (2026-09-08): the previous
        // `if (res.ok)` branch silently swallowed the 400.
        // The route schema now accepts `[docKey]: null`, so
        // any future regression surfaces here.
        const body = await res.json().catch(() => null);
        const message = body?.error?.message || body?.message || `KYC delete failed (${res.status})`;
        toast.error(message);
      }
    } catch (err) {
      logger.error('Failed to delete KYC document', { error: err });
      toast.error('KYC delete failed');
    } finally {
      setSaving(false);
    }
  }, [selectedRider, deleteDocKey]);

  const handleBulkDeleteKycDocs = useCallback(async () => {
    if (!selectedRider || selectedKycDocs.size === 0) return;
    setSaving(true);
    try {
      const updates = Object.fromEntries(
        Array.from(selectedKycDocs).map((k) => [k, null])
      );
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRider.id, ...updates }),
      });
      if (res.ok) {
        setRiders((prev) =>
          prev.map((r) =>
            r.id === selectedRider.id ? ({ ...r, ...updates } as Rider) : r
          )
        );
        setSelectedRider((prev) =>
          prev ? ({ ...prev, ...updates } as Rider) : null
        );
        setSelectedKycDocs(new Set());
        toast.success(`${selectedKycDocs.size} KYC document(s) cleared.`);
      } else {
        // ADMIN-RIDER-AUDIT P0-2b (2026-09-08): same shape
        // as `confirmDeleteKycDoc` — surface the server's
        // reason instead of silent failure.
        const body = await res.json().catch(() => null);
        const message = body?.error?.message || body?.message || `Bulk KYC delete failed (${res.status})`;
        toast.error(message);
      }
    } catch (err) {
      logger.error('Failed to bulk delete KYC documents', { error: err });
      toast.error('Bulk KYC delete failed');
    } finally {
      setSaving(false);
    }
  }, [selectedRider, selectedKycDocs]);

  const handleKycAction = useCallback(async () => {
    if (!confirmKycAction) return;
    const { rider, action } = confirmKycAction;
    const statusMap: Record<KycActionKind, string> = {
      approve: 'APPROVED',
      reject: 'REJECTED',
      info_required: 'INFO_REQUIRED',
    };
    if (action === 'reject' || action === 'info_required') {
      if (kycRejectionReason.trim().length < 5) {
        toast.error('Please provide a reason of at least 5 characters.');
        return;
      }
      if (selectedKycDocs.size === 0) {
        toast.error('Please select at least one document or field that requires correction.');
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rider.id,
          kycStatus: statusMap[action],
          rejectionReason:
            action === 'reject' || action === 'info_required'
              ? kycRejectionReason.trim()
              : undefined,
          editableFields:
            action === 'reject' || action === 'info_required'
              ? Array.from(selectedKycDocs)
              : undefined,
        }),
      });
      if (res.ok) {
        const kycStatus = statusMap[action];
        setRiders((prev) =>
          prev.map((r) => (r.id === rider.id ? ({ ...r, kycStatus } as Rider) : r))
        );
        setSelectedRider((prev) =>
          prev ? ({ ...prev, kycStatus } as Rider) : null
        );
        setConfirmKycAction(null);
        setKycRejectionReason('');
        setSelectedKycDocs(new Set());
        toast.success(`KYC status updated to ${kycStatus}.`);
        await fetchRiders();
      } else {
        const body = await res.json().catch(() => null);
        const message = extractErrorMessage(body, `KYC update failed (${res.status})`);
        toast.error(message);
      }
    } catch (err) {
      logger.error('Failed to update KYC', { error: err });
      toast.error('Failed to update KYC');
    } finally {
      setSaving(false);
    }
  }, [confirmKycAction, kycRejectionReason, selectedKycDocs, fetchRiders]);

  const toggleKycDoc = useCallback((docKey: string) => {
    setSelectedKycDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docKey)) next.delete(docKey);
      else next.add(docKey);
      return next;
    });
  }, []);

  const handleDeleteRider = useCallback(
    async (riderId: string) => {
      if (confirmDelete !== riderId) {
        setConfirmDelete(riderId);
        return;
      }
      try {
        const res = await fetch(`/api/admin/riders?id=${riderId}`, { method: 'DELETE' });
        if (res.ok) {
          setRiders((prev) => prev.filter((r) => r.id !== riderId));
          if (selectedRider?.id === riderId) setSelectedRider(null);
          toast.success('Rider deleted.');
        } else {
          const body = await res.json().catch(() => null);
          const message = extractErrorMessage(body, `Delete failed (${res.status})`);
          toast.error(message);
        }
      } catch (err) {
        logger.error('Delete failed', { error: err });
        toast.error('Delete failed');
      } finally {
        setConfirmDelete(null);
      }
    },
    [confirmDelete, selectedRider]
  );

  // NET-005 follow-up-20 (2026-09-08): the
  // `handleTlAction` function was removed. It
  // PUT'd `{ id, tlAction }` to
  // `/api/admin/riders`; the route's
  // `updateRiderSchema` strips `tlAction`, so
  // the action was a server-side no-op. The
  // corresponding `tlChangeRequested` /
  // `tlChangeReason` alert block in
  // `RiderProfileTab` is also removed. A
  // follow-up ticket should build the
  // TL-change-request feature properly.

  const handleClearGuarantor = useCallback(() => {
    setConfirmClearGuarantor(true);
  }, []);

  const confirmClearGuarantorAction = useCallback(async () => {
    if (!selectedRider) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRider.id,
          guarantorName: null,
          guarantorRelation: null,
          guarantorPhone: null,
          guarantorDob: null,
          guarantorStatus: null,
          guarantorAadhaarFront: null,
          guarantorAadhaarBack: null,
          guarantorPan: null,
          guarantorVideo: null,
          guarantorSignature: null,
        }),
      });
      if (res.ok) {
        const cleared = {
          ...selectedRider,
          guarantorName: null,
          guarantorRelation: null,
          guarantorPhone: null,
          guarantorDob: null,
          guarantorStatus: '',
          guarantorAadhaarFront: null,
          guarantorAadhaarBack: null,
          guarantorPan: null,
          guarantorVideo: null,
          guarantorSignature: null,
        };
        setSelectedRider(cleared as Rider);
        setRiders((prev) =>
          prev.map((r) => (r.id === selectedRider.id ? (cleared as Rider) : r))
        );
        toast.success('Guarantor cleared.');
      } else {
        // ADMIN-RIDER-AUDIT P0-2a (2026-09-08): the previous
        // `if (res.ok)` branch silently swallowed the 400
        // from the schema's `z.string().max(100).optional()`
        // (no nullable). The schema now accepts null on
        // every guarantor text field; any future regression
        // surfaces here.
        const body = await res.json().catch(() => null);
        const message = extractErrorMessage(body, `Clear guarantor failed (${res.status})`);
        toast.error(message);
      }
    } catch (err) {
      logger.error('Failed to clear guarantor', { error: err });
      toast.error('Clear guarantor failed');
    } finally {
      setSaving(false);
      setConfirmClearGuarantor(false);
    }
  }, [selectedRider]);

  // NET-005 follow-up-23 (2026-09-08): the
  // hook's `startEditing` was DEAD CODE that
  // did `setEditForm({ ...selectedRider })`.
  // The full spread would have copied
  // masked PII (`aadhaarNumber`,
  // `accountNumber` — `XXXX1234`-style) and
  // the `walletBalance` computed field
  // (which `update()` throws on by design,
  // returning a 500). The dialog has its own
  // LOCAL whitelisted `startEditing` that
  // only picks the form fields it edits
  // (RiderDetailDialog.tsx:130) — that's
  // what the button click calls. This
  // hook-level `startEditing` is one import
  // away from being wired in: any future
  // refactor that passes the hook's
  // `startEditing` to the button (instead
  // of relying on the dialog's local one)
  // would silently re-introduce the
  // masked-PII writeback. Deleted; see the
  // export block for the regression note.
  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(riders.map((r) => r.id)) : new Set());
    },
    [riders]
  );

  const toggleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const onSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAddRider = useCallback(async () => {
    if (newRider.phone.length < 10) return;
    setAddingRider(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRider),
      });
      if (res.ok) {
        setShowAddDialog(false);
        setNewRider({ phone: '', fullName: '' });
        toast.success('Rider added.');
        await fetchRiders();
      } else {
        const body = await res.json().catch(() => null);
        const message =
          body?.error?.message ||
          body?.message ||
          `Failed to add rider (${res.status})`;
        toast.error(message);
      }
    } catch (err) {
      logger.error('Failed to add rider', { error: err });
      toast.error('Failed to add rider');
    } finally {
      setAddingRider(false);
    }
  }, [newRider, fetchRiders]);

  return {
    // modal states
    showAddDialog,
    setShowAddDialog,
    newRider,
    setNewRider,
    addingRider,
    handleAddRider,
    showAdjustWallet,
    setShowAdjustWallet,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    // data
    riders,
    loading,
    searching,
    fetchError,
    onRetry: fetchRiders,
    // filters
    search,
    setSearch,
    onSearchChange: setSearch,
    stateFilter,
    setStateFilter,
    onStateFilterChange: setStateFilter,
    kycFilter,
    setKycFilter,
    onKycFilterChange: setKycFilter,
    page,
    setPage,
    onPageChange: setPage,
    totalPages,
    total,
    sortKey,
    sortDir,
    onSort,
    // selection
    selectedIds,
    setSelectedIds,
    toggleSelectAll,
    onToggleAll: toggleSelectAll,
    toggleSelectOne,
    onToggleOne: toggleSelectOne,
    clearSelection,
    bulkLoading,
    handleBulkAction,
    handleUndo,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    // detail
    selectedRider,
    setSelectedRider,
    onViewDetails: setSelectedRider,
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    saving,
    // NET-005 follow-up-23 (2026-09-08):
    // `startEditing` removed from the hook
    // return. The function was DEAD CODE
    // (no caller) and the full-spread
    // `setEditForm({ ...selectedRider })`
    // would have copied masked PII and the
    // `walletBalance` computed field. The
    // dialog has its own LOCAL whitelisted
    // `startEditing` (RiderDetailDialog.tsx:130)
    // — that's what the button click calls.
    handleUpdateRider,
    handleDeleteRider,
    confirmDelete,
    setConfirmDelete,
    onDelete: setConfirmDelete,
    // NET-005 follow-up-20 (2026-09-08):
    // `handleTlAction` removed from the
    // hook return — the function no longer
    // exists and the alert block in
    // `RiderProfileTab` that consumed it
    // was deleted.
    // KYC
    selectedKycDocs,
    setSelectedKycDocs,
    toggleKycDoc,
    confirmKycAction,
    setConfirmKycAction,
    kycRejectionReason,
    setKycRejectionReason,
    handleKycAction,
    handleDeleteKycDoc,
    deleteDocKey,
    setDeleteDocKey,
    confirmDeleteKycDoc,
    handleBulkDeleteKycDocs,
    // guarantor
    handleClearGuarantor,
    confirmClearGuarantor,
    setConfirmClearGuarantor,
    confirmClearGuarantorAction,
    // revalidation
    fetchRiders,
  };
}

export type RidersHook = ReturnType<typeof useRiders>;
