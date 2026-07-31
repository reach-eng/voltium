'use client';

import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import type { KycRider } from './kyc-types';

export type KycAction = 'approve' | 'reject' | 'info_required';
export type KycTab = 'pending' | 'approved' | 'rejected' | 'info_required' | 'all';

export interface ConfirmAction {
  rider: KycRider;
  action: KycAction;
}

export interface LastKycAction {
  ids: string[];
  previousStatuses: Record<string, string>;
  action: string;
}

const STATUS_MAP: Record<KycAction, string> = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  info_required: 'INFO_REQUIRED',
};

/**
 * R3.7m split — KYC management data hook.
 *
 * Owns the rider list + tab + date range, the per-rider selection,
 * the row + bulk + undo state, the per-row loading flag, the
 * rejection reason input, the export progress meter, and the
 * keyboard shortcut handler (Ctrl+A/K/R/Z). The hook is the
 * single source of truth — the orchestrator just wires components.
 */
export function useKycManagement() {
  const [riders, setRiders] = useState<KycRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<KycTab>('pending');
  const [selectedRider, setSelectedRider] = useState<KycRider | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<LastKycAction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rowLoadingIds, setRowLoadingIds] = useState<Set<string>>(new Set());

  const fetchRiders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (tab === 'info_required') {
        params.set('kycStatus', 'INFO_REQUIRED');
      } else if (tab === 'pending') {
        params.append('kycStatus', 'PENDING');
        params.append('kycStatus', 'SUBMITTED');
      } else if (tab !== 'all') {
        params.set('kycStatus', tab.toUpperCase());
      }
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/admin/riders?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data?.riders || json.data || [];
        setRiders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      logger.error('Failed to fetch riders for KYC', { error: err });
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  const filteredRiders = Array.isArray(riders) ? riders : [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRiders.length && filteredRiders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRiders.map((r) => r.id)));
    }
  };

  const handleKycAction = useCallback(async () => {
    if (!confirmAction) return;
    const { rider, action } = confirmAction;
    setRowLoadingIds((prev) => new Set([...prev, rider.id]));
    setActionLoading(true);
    const previousStatus = rider.kycStatus;
    try {
      await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rider.id,
          kycStatus: STATUS_MAP[action],
          rejectionReason:
            action === 'reject' || action === 'info_required' ? rejectionReason : undefined,
        }),
      });
      setLastAction({
        ids: [rider.id],
        previousStatuses: { [rider.id]: previousStatus },
        action: STATUS_MAP[action],
      });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      setConfirmAction(null);
      setRejectionReason('');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rider.id);
        return next;
      });
      fetchRiders();
      if (selectedRider?.id === rider.id) {
        setSelectedRider({ ...rider, kycStatus: STATUS_MAP[action] });
      }
    } catch (err) {
      logger.error('Failed to update KYC', { error: err });
    } finally {
      setActionLoading(false);
      setRowLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(rider.id);
        return next;
      });
    }
  }, [confirmAction, rejectionReason, selectedRider, fetchRiders]);

  const handleUndo = useCallback(async () => {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const promises = Object.entries(lastAction.previousStatuses).map(([id, status]) =>
        fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, kycStatus: status }),
        })
      );
      await Promise.all(promises);
      setLastAction(null);
      setShowUndoToast(false);
      fetchRiders();
    } catch (err) {
      logger.error('Undo failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  }, [lastAction, fetchRiders]);

  const handleBulkAction = useCallback(
    async (action: KycAction) => {
      const targets = filteredRiders.filter((r) => selectedIds.has(r.id));
      const targetIds = targets.map((r) => r.id);
      setRowLoadingIds((prev) => new Set([...prev, ...targetIds]));
      const previousStatuses: Record<string, string> = {};
      targets.forEach((r) => {
        previousStatuses[r.id] = r.kycStatus;
      });

      setBulkLoading(true);
      try {
        await fetch('/api/admin/riders/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: targetIds,
            action: 'bulkKyc',
            value: STATUS_MAP[action],
          }),
        });
        setLastAction({
          ids: targetIds,
          previousStatuses,
          action: STATUS_MAP[action],
        });
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
        setSelectedIds(new Set());
        fetchRiders();
      } catch (err) {
        logger.error('Bulk KYC action failed', { error: err });
      } finally {
        setBulkLoading(false);
        setRowLoadingIds((prev) => {
          const next = new Set(prev);
          targetIds.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [filteredRiders, selectedIds, fetchRiders]
  );

  // Keyboard shortcuts: Ctrl+A select-all, Ctrl+K approve, Ctrl+R
  // reject, Ctrl+Z undo. Suppressed while typing in inputs or when
  // a confirm dialog is open.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (confirmAction) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        toggleSelectAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (selectedIds.size > 0 && !bulkLoading) handleBulkAction('approve');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (selectedIds.size > 0 && !bulkLoading) handleBulkAction('reject');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, bulkLoading, lastAction, confirmAction]);

  return {
    // data
    riders,
    filteredRiders,
    loading,
    // tab + date
    tab,
    setTab,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    // selection
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    // dialogs
    selectedRider,
    setSelectedRider,
    confirmAction,
    setConfirmAction,
    rejectionReason,
    setRejectionReason,
    // bulk
    bulkLoading,
    handleBulkAction,
    handleUndo,
    handleKycAction,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    actionLoading,
    rowLoadingIds,
    // export
    exportProgress,
    setExportProgress,
    // revalidation
    fetchRiders,
  };
}

export type KycManagementHook = ReturnType<typeof useKycManagement>;
