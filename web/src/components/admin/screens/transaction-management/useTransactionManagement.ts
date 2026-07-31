'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Transaction } from './types';

export type TransactionTab = 'pending' | 'approved' | 'rejected' | 'TOP_UP' | 'DEBIT' | 'all';
export type SortDirection = 'asc' | 'desc';

export interface ConfirmAction {
  tx: Transaction;
  action: 'approve' | 'reject';
}

export interface LastTransactionBulkAction {
  ids: string[];
  previousStates: Record<string, { status: string; rejectionReason: string | null }>;
  action: string;
}

/**
 * R3 split (TransactionManagement) — data hook.
 *
 * Owns the 22-state machine (list, tab, search, dates, page,
 * sort, selection, bulk, undo, deduct dialog, action dialog,
 * credit toggle). Also owns the 5 fetch handlers
 * (fetchTransactions, handleAction, handleBulkAction, handleUndo,
 * handleDeduct) plus the keyboard shortcut handler (Ctrl+A
 * select-all pending, Ctrl+Z undo). The hook is the single
 * source of truth — the shell just wires components.
 */
export function useTransactionManagement() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TransactionTab>('pending');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<LastTransactionBulkAction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [bulkRejectDialog, setBulkRejectDialog] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [creditWallet, setCreditWallet] = useState(false);
  const [walletCreditAmount, setWalletCreditAmount] = useState(0);

  const [deductDialog, setDeductDialog] = useState(false);
  const [deductRiderId, setDeductRiderId] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [deductReason, setDeductReason] = useState('');
  const [deductLoading, setDeductLoading] = useState(false);

  const mountedRef = useRef(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === 'TOP_UP') {
        params.set('type', 'TOP_UP');
      } else if (tab === 'DEBIT') {
        params.set('type', 'DEBIT');
      } else if (tab !== 'all') {
        params.set('status', tab.toUpperCase());
      }
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/transactions?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTransactions(json.data || []);
          if (json.pagination) {
            setTotalPages(json.pagination.totalPages);
            setTotal(json.pagination.total);
          }
        }
      }
    } catch (err) {
      logger.error('Failed to fetch transactions', { error: err });
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedSearch, startDate, endDate, page]);

  // Debounce search → 500ms before triggering a re-fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleDeduct = async () => {
    if (!deductRiderId || !deductAmount || !deductReason) {
      toast.error('Please fill in all fields');
      return;
    }
    setDeductLoading(true);
    try {
      const res = await fetch(`/api/admin/riders/${deductRiderId}/wallet-adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DEBIT',
          amount: Number(deductAmount),
          reason: deductReason,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to deduct');
      toast.success('Amount deducted successfully');
      setDeductDialog(false);
      setDeductRiderId('');
      setDeductAmount('');
      setDeductReason('');
      fetchTransactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeductLoading(false);
    }
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    const { tx, action } = confirmAction;
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = {
        id: tx.id,
        action: action === 'approve' ? 'APPROVE' : 'REJECT',
      };
      if (action === 'reject' && rejectionReason) {
        body.rejectionReason = rejectionReason;
      }
      if (action === 'approve' && creditWallet && walletCreditAmount > 0) {
        body.walletCreditAmount = walletCreditAmount;
      }

      const res = await fetch('/api/admin/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || `Failed to ${action} transaction`);
        return;
      }
      toast.success(`Transaction ${action === 'approve' ? 'approved' : 'rejected'}`);
      setConfirmAction(null);
      setRejectionReason('');
      fetchTransactions();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const closeConfirmDialog = () => {
    setConfirmAction(null);
    setCreditWallet(false);
    setWalletCreditAmount(0);
  };

  const handleBulkAction = async (action: 'approve' | 'reject', reason?: string) => {
    if (selectedIds.size === 0) return;
    const previousStates: LastTransactionBulkAction['previousStates'] = {};
    transactions
      .filter((tx) => selectedIds.has(tx.id))
      .forEach((tx) => {
        previousStates[tx.id] = { status: tx.status, rejectionReason: tx.rejectionReason };
      });
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Bulk action failed');
        setBulkLoading(false);
        return;
      }
      toast.success(
        `${selectedIds.size} transaction(s) ${action === 'approve' ? 'approved' : 'rejected'}`
      );
      setLastAction({ ids: Array.from(selectedIds), previousStates, action });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      setSelectedIds(new Set());
      fetchTransactions();
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
      const results = await Promise.allSettled(
        lastAction.ids.map((id) =>
          fetch('/api/admin/transactions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action: 'REVERT' }),
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error('Undo partial failure', { failed: failed.length, total: results.length });
        toast.error(`Undo partially failed (${failed.length}/${results.length})`);
      } else {
        toast.success('Undo successful');
      }
      setLastAction(null);
      setShowUndoToast(false);
      fetchTransactions();
    } catch {
      toast.error('Undo failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Local sort on the current page
  const sorted = sortKey
    ? [...transactions].sort((a, b) => {
        const aVal = a[sortKey as keyof Transaction] ?? '';
        const bVal = b[sortKey as keyof Transaction] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : transactions;

  // Keyboard shortcuts: Ctrl+A select-all pending, Ctrl+Z undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(sorted.filter((tx) => tx.status === 'PENDING').map((tx) => tx.id)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, lastAction, bulkLoading]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleExportSelected = () => {
    const header = 'ID,Rider,Phone,Type,Amount,Purpose,Status,Date';
    const rows = transactions
      .filter((tx) => selectedIds.has(tx.id))
      .map((tx) =>
        [
          tx.id.substring(0, 8),
          tx.rider?.fullName || tx.rider?.name || '',
          tx.rider?.phone,
          tx.type,
          tx.amount,
          tx.purpose,
          tx.status,
          tx.createdAt,
        ].join(',')
      );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions-${formatDateDDMMYYYY(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    // data
    transactions,
    sorted,
    loading,
    total,
    totalPages,
    // tab + filters
    tab,
    setTab,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    // sort
    sortKey,
    sortDir,
    handleSort,
    // selection
    selectedIds,
    setSelectedIds,
    handleToggleSelect,
    // details
    selectedTx,
    setSelectedTx,
    // confirm dialog
    confirmAction,
    setConfirmAction,
    closeConfirmDialog,
    rejectionReason,
    setRejectionReason,
    actionLoading,
    handleAction,
    // bulk
    bulkLoading,
    handleBulkAction,
    handleUndo,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    bulkRejectDialog,
    setBulkRejectDialog,
    bulkRejectReason,
    setBulkRejectReason,
    // approve + credit
    creditWallet,
    setCreditWallet,
    walletCreditAmount,
    setWalletCreditAmount,
    // deduct dialog
    deductDialog,
    setDeductDialog,
    deductRiderId,
    setDeductRiderId,
    deductAmount,
    setDeductAmount,
    deductReason,
    setDeductReason,
    deductLoading,
    handleDeduct,
    // export
    handleExportSelected,
    // revalidation
    fetchTransactions,
  };
}

export type TransactionManagementHook = ReturnType<typeof useTransactionManagement>;
