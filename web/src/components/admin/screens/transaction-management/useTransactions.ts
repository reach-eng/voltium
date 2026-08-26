import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { Transaction, ConfirmActionState, LastBulkAction } from './types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [confirmAction, setConfirmAction] =
    useState<ConfirmActionState | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<LastBulkAction | null>(null);
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

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
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

  async function handleDeduct() {
    if (!deductRiderId || !deductAmount || !deductReason) {
      toast.error('Please fill in all fields');
      return;
    }
    setDeductLoading(true);
    try {
      const res = await fetch(
        `/api/admin/riders/${deductRiderId}/wallet-adjust`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'DEBIT',
            amount: Number(deductAmount),
            reason: deductReason,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.error?.message || 'Failed to deduct');
      toast.success('Amount deducted successfully');
      setDeductDialog(false);
      setDeductRiderId('');
      setDeductAmount('');
      setDeductReason('');
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {

        setDeductLoading(false);
    }
  }

  async function handleAction() {
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
        toast.error(
          json?.error?.message || `Failed to ${action} transaction`,
        );
        return;
      }
      toast.success(
        `Transaction ${action === 'approve' ? 'approved' : 'rejected'}`,
      );
      setConfirmAction(null);
      setRejectionReason('');
      fetchTransactions();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {

        setActionLoading(false);
    }
  }

  async function handleBulkAction(
    action: 'approve' | 'reject',
    reason?: string,
  ) {
    if (selectedIds.size === 0) return;
    const previousStates: Record<string, any> = {};
    transactions
      .filter((tx) => selectedIds.has(tx.id))
      .forEach((tx) => {
        previousStates[tx.id] = {
          status: tx.status,
          rejectionReason: tx.rejectionReason,
        };
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
        `${selectedIds.size} transaction(s) ${
          action === 'approve' ? 'approved' : 'rejected'
        }`,
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
  }

  async function handleUndo() {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const results = await Promise.allSettled(
        lastAction.ids.map((id) =>
          fetch('/api/admin/transactions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action: 'REVERT' }),
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error('Undo partial failure', {
          failed: failed.length,
          total: results.length,
        });
        toast.error(
          `Undo partially failed (${failed.length}/${results.length})`,
        );
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
  }

  const sorted = sortKey
    ? [...transactions].sort((a, b) => {
        const aVal = a[sortKey as keyof Transaction] ?? '';
        const bVal = b[sortKey as keyof Transaction] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
        });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : transactions;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(
          new Set(
            sorted
              .filter((tx) => tx.status === 'PENDING')
              .map((tx) => tx.id),
          ),
        );
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sorted, lastAction, bulkLoading]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return {
    transactions,
    sorted,
    loading,
    tab,
    setTab,
    selectedTx,
    setSelectedTx,
    confirmAction,
    setConfirmAction,
    rejectionReason,
    setRejectionReason,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    totalPages,
    total,
    sortKey,
    sortDir,
    handleSort,
    selectedIds,
    setSelectedIds,
    bulkLoading,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    bulkRejectDialog,
    setBulkRejectDialog,
    bulkRejectReason,
    setBulkRejectReason,
    actionLoading,
    creditWallet,
    setCreditWallet,
    walletCreditAmount,
    setWalletCreditAmount,
    deductDialog,
    setDeductDialog,
    deductRiderId,
    setDeductRiderId,
    deductAmount,
    setDeductAmount,
    deductReason,
    setDeductReason,
    deductLoading,
    fetchTransactions,
    handleDeduct,
    handleAction,
    handleBulkAction,
    handleUndo,
  };
}
