'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRiders = useCallback(async () => {
    setLoading(true);
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
      }
    } catch (err) {
      logger.error('Failed to fetch riders', { error: err });
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
      const previousStates: Record<string, { state: string; accountStatus: string }> = {};
      riders
        .filter((r) => selectedIds.has(r.id))
        .forEach((r) => {
          previousStates[r.id] = { state: r.state, accountStatus: r.accountStatus };
        });

      setBulkLoading(true);
      try {
        const res = await fetch('/api/admin/riders/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds), action, value }),
        });
        if (res.ok) {
          setLastAction({
            ids: Array.from(selectedIds),
            previousStates,
            action: value || action,
          });
          setShowUndoToast(true);
          setTimeout(() => setShowUndoToast(false), 5000);
          setSelectedIds(new Set());
          await fetchRiders();
        }
      } catch (err) {
        logger.error('Bulk action failed', { error: err });
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
      const promises = Object.entries(lastAction.previousStates).map(([id, prev]) =>
        fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, state: prev.state, accountStatus: prev.accountStatus }),
        })
      );
      await Promise.all(promises);
      setLastAction(null);
      setShowUndoToast(false);
      await fetchRiders();
    } catch (err) {
      logger.error('Undo failed', { error: err });
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
      }
    } catch (err) {
      logger.error('Failed to update rider', { error: err });
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
      }
    } catch (err) {
      logger.error('Failed to delete KYC document', { error: err });
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
      }
    } catch (err) {
      logger.error('Failed to bulk delete KYC documents', { error: err });
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
              ? kycRejectionReason
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
      }
    } catch (err) {
      logger.error('Failed to update KYC', { error: err });
    } finally {
      setSaving(false);
    }
  }, [confirmKycAction, kycRejectionReason, selectedKycDocs]);

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
        }
      } catch (err) {
        logger.error('Delete failed', { error: err });
      } finally {
        setConfirmDelete(null);
      }
    },
    [confirmDelete, selectedRider]
  );

  const handleTlAction = useCallback(
    async (riderId: string, action: 'approve' | 'reject') => {
      try {
        const res = await fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: riderId, tlAction: action }),
        });
        if (res.ok) {
          await fetchRiders();
          if (selectedRider?.id === riderId) {
            const json = await res.json();
            setSelectedRider(json.data);
          }
        }
      } catch (err) {
        logger.error('Failed to process TL action', { error: err });
      }
    },
    [fetchRiders, selectedRider]
  );

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
      }
    } catch (err) {
      logger.error('Failed to clear guarantor', { error: err });
    } finally {
      setSaving(false);
      setConfirmClearGuarantor(false);
    }
  }, [selectedRider]);

  const startEditing = useCallback(() => {
    if (!selectedRider) return;
    setEditForm({ ...selectedRider });
    setIsEditing(true);
  }, [selectedRider]);

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

  return {
    // data
    riders,
    loading,
    searching,
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
    totalPages,
    total,
    sortKey,
    sortDir,
    onSort,
    // selection
    selectedIds,
    toggleSelectAll,
    toggleSelectOne,
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
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    saving,
    startEditing,
    handleUpdateRider,
    handleDeleteRider,
    confirmDelete,
    setConfirmDelete,
    handleTlAction,
    // KYC
    selectedKycDocs,
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
