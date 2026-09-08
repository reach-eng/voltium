'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/extract-error';
import type { KycRider, KycConfirmAction, LastKycBulkAction, KycBulkConfirmAction } from './types';
import { KYC_PAGE_SIZE } from './types';

/**
 * Build the KYC queue URL for a given filter set + page.
 *
 * NET-005 follow-up-12 (2026-09-08): the pre-fix hook
 * hardcoded `limit=100` and never sent `page`, so the
 * KYC review queue silently capped at 100 records with
 * no way to navigate past the first page. The server
 * (`riders/route.ts:189-190`) already supported page-
 * based pagination and returned a
 * `pagination: {page, limit, total, totalPages, nextCursor}`
 * block. The hook now pages through the queue using
 * this helper.
 *
 * Pure function so it can be unit-tested without a
 * React renderer.
 */
export function buildKycQueueUrl(input: {
  tab: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(input.pageSize));
  params.set('page', String(input.page));
  if (input.tab === 'info_required') {
    params.set('kycStatus', 'INFO_REQUIRED');
  } else if (input.tab === 'pending') {
    params.set('kycStatus', 'PENDING');
  } else if (input.tab === 'submitted') {
    params.set('kycStatus', 'SUBMITTED');
  } else if (input.tab !== 'all') {
    params.set('kycStatus', input.tab.toUpperCase());
  }
  if (input.startDate) params.set('startDate', input.startDate);
  if (input.endDate) params.set('endDate', input.endDate);
  return `/api/admin/riders?${params.toString()}`;
}

export function useKyc() {
  const [riders, setRiders] = useState<KycRider[]>([]);
  const [loading, setLoading] = useState(true);
  // P0-2: Default landing tab is 'submitted' (actionable cohort).
  // 'pending' is a view-only funnel tab where riders have not submitted docs yet.
  const [tab, setTab] = useState('submitted');
  // NET-005 follow-up-12: page state for the queue.
  // `page` is 1-indexed to match the server's
  // `parsePositiveInt(... 'page', 1)` default in
  // `riders/route.ts:189`.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRider, setSelectedRider] = useState<KycRider | null>(null);
  const [confirmAction, setConfirmAction] = useState<KycConfirmAction | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<KycBulkConfirmAction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedKycDocs, setSelectedKycDocs] = useState<Set<string>>(new Set());
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
      const url = buildKycQueueUrl({
        tab,
        startDate,
        endDate,
        page,
        pageSize: KYC_PAGE_SIZE,
      });
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const data = json.data?.riders || json.data || [];
        setRiders(Array.isArray(data) ? data : []);
        if (json.data?.pagination) {
          setTotalPages(json.data.pagination.totalPages || 1);
          setTotal(json.data.pagination.total || 0);
        }
      } else {
        toast.error('Failed to fetch KYC queue.');
      }
    } catch (err) {
      logger.error('Failed to fetch riders for KYC', { error: err });
      toast.error('Network error loading KYC queue.');
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate, page]);

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  // NET-005 follow-up-12: when filters change, reset to
  // page 1 and clear selected rows so selections from one
  // tab do not leak into another tab.
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [tab, startDate, endDate]);

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
    // P0-2: PENDING rows are view-only and cannot be bulk-actioned.
    const actionable = filteredRiders.filter((r) => r.kycStatus !== 'PENDING');
    if (selectedIds.size === actionable.length && actionable.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionable.map((r) => r.id)));
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
      // P1-3 (Phase 4): REJECT and INFO_REQUIRED require at least one document/field to correct
      if ((action === 'reject' || action === 'info_required') && selectedKycDocs.size === 0) {
        toast.error('Please select at least one document or field that requires correction.');
        return;
      }
      // NET-005 follow-up-13 (2026-09-08): the reopen
      // action routes through `/api/admin/kyc` (not
      // `/api/admin/riders`) so the kyc POST handler's
      // `action: 'REOPEN'` branch runs the dedicated
      // `kycUseCases.reopenExpiredKyc` path — which
      // validates the EXPIRED → PENDING state-machine
      // transition, writes the `kyc.reopened` audit
      // log, and emits the KYC_REOPENED outbox event.
      // The riders PUT path would bypass all three of
      // those steps (it just writes the kycStatus
      // column) and was the original dead-end pattern
      // we're closing.
      let res: Response;
      if (action === 'reopen') {
        res = await fetch('/api/admin/kyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riderId: rider.id, action: 'REOPEN' }),
        });
      } else {
        res = await fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: rider.id,
            kycStatus: statusMap[action],
            rejectionReason:
              action === 'reject' || action === 'info_required'
                ? rejectionReason.trim()
                : undefined,
            editableFields:
              action === 'reject' || action === 'info_required'
                ? Array.from(selectedKycDocs)
                : undefined,
          }),
        });
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = extractErrorMessage(errJson, `Request failed: ${res.status}`);
        throw new Error(msg);
      }
      // NET-005 follow-up-13 (2026-09-08): use the
      // `action` enum directly for the toast (no
      // `statusMap` for `reopen` — it goes to PENDING
      // server-side, but the user-facing label is
      // "re-verify").
      const successLabel =
        action === 'reopen'
          ? 'KYC re-opened for re-submission'
          : `Rider KYC ${statusMap[action].toLowerCase()}`;
      toast.success(successLabel);
      // NET-005 follow-up-10 (2026-09-08): only offer
      // undo for reversible KYC transitions. The KYC
      // state machine allows APPROVED → EXPIRED only,
      // so "undoing" an approval by reverting to
      // SUBMITTED/REJECTED/INFO_REQUIRED is always an
      // illegal transition (the API returns 409).
      // Recording `lastAction` for approves caused the
      // Undo button to appear for ~5s after every
      // approval and then always 409 when clicked.
      // REJECT (REJECTED → SUBMITTED) and INFO_REQUIRED
      // (INFO_REQUIRED → SUBMITTED) are reversible and
      // keep the undo affordance.
      if (action !== 'approve' && action !== 'reopen') {
        setLastAction({
          ids: [rider.id],
          previousStatuses: { [rider.id]: previousStatus },
          action: statusMap[action],
        });
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
      }
      setConfirmAction(null);
      setRejectionReason('');
      setSelectedKycDocs(new Set());
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rider.id);
        return next;
      });
      fetchRiders();
      if (selectedRider?.id === rider.id) {
        setSelectedRider({ ...rider, kycStatus: action === 'reopen' ? 'PENDING' : statusMap[action] });
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
        // NET-005 follow-up-10 (2026-09-08): the
        // pre-fix code threw a generic "Undo failed
        // for <id>" string, throwing away the API's
        // actual error message. The riders route now
        // returns 409 with the state-machine
        // explanation for illegal transitions, e.g.
        // `Invalid KYC transition: "APPROVED" →
        // "SUBMITTED". Allowed: EXPIRED.`. Surface
        // that message so the admin knows why the
        // undo failed instead of seeing a generic
        // "Undo failed. Please try again." toast.
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(
            extractErrorMessage(errJson, `Undo failed for ${id} (HTTP ${res.status})`)
          );
        }
      });
      await Promise.all(promises);
      toast.success('Undo successful');
      setLastAction(null);
      setShowUndoToast(false);
      fetchRiders();
    } catch (err: any) {
      logger.error('Undo failed', { error: err });
      toast.error(err?.message || 'Undo failed. Please try again.');
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
        const msg = extractErrorMessage(errJson, `Bulk request failed: ${res.status}`);
        throw new Error(msg);
      }

      // P1-2: Parse count and failures from the bulk response
      const resJson = await res.json().catch(() => ({}));
      const resData = resJson.data || resJson;
      const updatedCount = typeof resData.count === 'number' ? resData.count : targetIds.length;
      const failures: { id: string; error: string }[] = Array.isArray(resData.failures)
        ? resData.failures
        : [];

      const failedIds = new Set(failures.map((f) => f.id));
      const succeededIds = targetIds.filter((id) => !failedIds.has(id));

      if (failures.length > 0) {
        // P1-2: Retain selection on failed IDs so admin can review or retry
        setSelectedIds(failedIds);

        const firstError = failures[0]?.error;
        if (updatedCount > 0) {
          // Partial failure: updated X of N (Y failed)
          toast.warning(
            `Updated ${updatedCount} of ${targetIds.length} on this page (${failures.length} failed${
              firstError ? `: ${firstError}` : ''
            })`
          );
        } else {
          // All selected failed
          toast.error(
            `Failed to update ${failures.length} rider(s) on this page${
              firstError ? `: ${firstError}` : ''
            }`
          );
        }
      } else {
        // Full success: clear selection
        setSelectedIds(new Set());
        toast.success(
          `Bulk KYC ${statusMap[action].toLowerCase()} applied to ${updatedCount} rider(s) on this page`
        );
      }

      // NET-005 follow-up-10: only offer undo for reversible KYC transitions
      // and only for the rows that actually succeeded.
      if (action !== 'approve' && succeededIds.length > 0) {
        const succeededPreviousStatuses: Record<string, string> = {};
        succeededIds.forEach((id) => {
          if (previousStatuses[id]) {
            succeededPreviousStatuses[id] = previousStatuses[id];
          }
        });
        setLastAction({
          ids: succeededIds,
          previousStatuses: succeededPreviousStatuses,
          action: statusMap[action],
        });
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
      }

      setBulkConfirmAction(null);
      setBulkRejectionReason('');
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
    // NET-005 follow-up-12: pagination state for the queue.
    page,
    setPage,
    totalPages,
    total,
    selectedRider,
    setSelectedRider,
    confirmAction,
    setConfirmAction,
    bulkConfirmAction,
    setBulkConfirmAction,
    rejectionReason,
    setRejectionReason,
    selectedKycDocs,
    setSelectedKycDocs,
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
