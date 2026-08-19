'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { KycRider, KycConfirmAction, LastKycBulkAction, KycBulkConfirmAction } from './types';

export function useKyc() {
  const [riders, setRiders] = useState<KycRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [selectedRider, setSelectedRider] = useState<KycRider | null>(null);
  const [confirmAction, setConfirmAction] = useState<KycConfirmAction | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<KycBulkConfirmAction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<LastKycBulkAction | null>(null);
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
        params.set('kycStatus', 'PENDING');
      } else if (tab === 'submitted') {
        params.set('kycStatus', 'SUBMITTED');
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
      } else {
        toast.error('Failed to fetch KYC queue.');
      }
    } catch (err) {
      logger.error('Failed to fetch riders for KYC', { error: err });
      toast.error('Network error loading KYC queue.');
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

  const handleKycAction = async () => {
    if (!confirmAction) return;
    const { rider, action } = confirmAction;
    setRowLoadingIds((prev) => new Set([...prev, rider.id]));
    setActionLoading(true);
    const statusMap = { approve: 'APPROVED', reject: 'REJECTED', info_required: 'INFO_REQUIRED' };
    const previousStatus = rider.kycStatus;
    try {
      if ((action === 'reject' || action === 'info_required') && rejectionReason.trim().length < 5) {
        toast.error('Please provide a reason of at least 5 characters.');
        return;
      }
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rider.id,
          kycStatus: statusMap[action],
          rejectionReason:
            action === 'reject' || action === 'info_required'
              ? rejectionReason.trim()
              : undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Request failed: ${res.status}`);
      }
      toast.success(`Rider KYC ${statusMap[action].toLowerCase()}`);
      setLastAction({
        ids: [rider.id],
        previousStatuses: { [rider.id]: previousStatus },
        action: statusMap[action],
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
        setSelectedRider({ ...rider, kycStatus: statusMap[action] });
      }
    } catch (err: any) {
      logger.error('Failed to update KYC', { error: err });
      toast.error(err?.message || 'Failed to update KYC');
    } finally {
      setActionLoading(false);
      setRowLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(rider.id);
        return next;
      });
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const promises = Object.entries(lastAction.previousStatuses).map(async ([id, status]) => {
        const res = await fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, kycStatus: status }),
        });
        if (!res.ok) throw new Error(`Undo failed for ${id}`);
      });
      await Promise.all(promises);
      toast.success('Undo successful');
      setLastAction(null);
      setShowUndoToast(false);
      fetchRiders();
    } catch (err: any) {
      logger.error('Undo failed', { error: err });
      toast.error('Undo failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAction = async (action: KycBulkConfirmAction, reason?: string) => {
    const statusMap = { approve: 'APPROVED', reject: 'REJECTED', info_required: 'INFO_REQUIRED' };
    const targets = filteredRiders.filter((r) => selectedIds.has(r.id));
    const targetIds = targets.map((r) => r.id);
    if (targetIds.length === 0) return;

    if (action === 'reject' && (!reason || reason.trim().length < 10)) {
      toast.error('Rejection reason must be at least 10 characters.');
      return;
    }
    if (action === 'info_required' && (!reason || reason.trim().length < 5)) {
      toast.error('Correction details must be at least 5 characters.');
      return;
    }

    setRowLoadingIds((prev) => new Set([...prev, ...targetIds]));
    const previousStatuses: Record<string, string> = {};
    targets.forEach((r) => {
      previousStatuses[r.id] = r.kycStatus;
    });

    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/riders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: targetIds,
          action: 'bulkKyc',
          value: statusMap[action],
          rejectionReason: reason?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Bulk request failed: ${res.status}`);
      }
      toast.success(`Bulk KYC ${statusMap[action].toLowerCase()} applied to ${targetIds.length} rider(s)`);
      setLastAction({
        ids: targetIds,
        previousStatuses,
        action: statusMap[action],
      });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      setBulkConfirmAction(null);
      setBulkRejectionReason('');
      setSelectedIds(new Set());
      fetchRiders();
    } catch (err: any) {
      logger.error('Bulk KYC action failed', { error: err });
      toast.error(err?.message || 'Bulk KYC action failed');
    } finally {
      setBulkLoading(false);
      setRowLoadingIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  return {
    riders,
    filteredRiders,
    loading,
    tab,
    setTab,
    selectedRider,
    setSelectedRider,
    confirmAction,
    setConfirmAction,
    bulkConfirmAction,
    setBulkConfirmAction,
    rejectionReason,
    setRejectionReason,
    bulkRejectionReason,
    setBulkRejectionReason,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    bulkLoading,
    exportProgress,
    setExportProgress,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    actionLoading,
    rowLoadingIds,

    // Handlers
    handleKycAction,
    handleBulkAction,
    handleUndo,
  };
}
