import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/error-utils';
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
  // T-AR-SORT (Filter & Sort Review, Step 5): sort moved from the client
  // (in-memory over the fetched page — gave a misleading "global" feel to
  // what was really page-local) to the server via `?sortBy`/`?sortDir`.
  // Allowlist lives in the route, so anything the table header exposes
  // is what the API accepts.
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
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
      } else if (tab === 'SECURITY_DEPOSIT') {
        params.set('purpose', 'SECURITY_DEPOSIT');
      } else if (tab !== 'all') {
        params.set('status', tab.toUpperCase());
      }
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      // T-AR-SORT: server-side sort. `null` sortKey (the 3rd click) is
      // intentionally NOT sent — the route's allowlist default
      // (`createdAt desc`) reproduces the same ordering the API used
      // before the header was clickable.
      if (sortKey && sortDir) {
        params.set('sortBy', sortKey);
        params.set('sortDir', sortDir);
      }
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/transactions?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && mountedRef.current) {
          setTransactions(json.data || []);
          if (json.pagination) {
            setTotalPages(json.pagination.totalPages);
            setTotal(json.pagination.total);
          }
        }
      } else {
        toast.error('Failed to load transactions. Please try again.');
      }
    } catch (err) {
      logger.error('Failed to fetch transactions', { error: err });
      toast.error('Failed to load transactions. Please try again.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [tab, debouncedSearch, startDate, endDate, page, sortKey, sortDir]);

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
  }, [tab, debouncedSearch, startDate, endDate, sortKey, sortDir]);

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
    if (!deductRiderId || !deductAmount || !deductReason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (deductReason.trim().length < 10) {
      toast.error('Please provide a reason of at least 10 characters');
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
      toast.error(extractErrorMessage(err, ''));
    } finally {
      if (mountedRef.current) {
        setDeductLoading(false);
      }
    }
  }

  async function handleAction() {
    if (!confirmAction) return;
    const { tx, action } = confirmAction;
    setActionLoading(true);
    try {
      // P1-2 (2026-08-07 verification, Section 2 — Admin Finance): the
      // server rejects a reject with < 10 chars of reason; surface the same
      // rule client-side so the admin gets a clear toast instead of a
      // generic failure after a round-trip.
      if (action === 'reject' && rejectionReason.trim().length < 10) {
        toast.error('Please provide a rejection reason of at least 10 characters');
        return;
      }
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
      if (mountedRef.current) {
        setConfirmAction(null);
        setRejectionReason('');
      }
      fetchTransactions();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
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
        body: JSON.stringify({ ids: Array.from(selectedIds), action, rejectionReason: reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Bulk action failed');
        if (mountedRef.current) {
          setBulkLoading(false);
        }
        return;
      }
      // P0-3 (financial audit): a partial run returns 207 with `failed` —
      // fetch's `res.ok` is true for 207, so without this check we'd show a
      // green toast over failures. Surface the failures and skip the undo
      // offer (undo assumes the whole batch landed).
      const failedCount = json?.data?.failed ?? 0;
      if (failedCount > 0) {
        toast.error(
          `${failedCount} of ${selectedIds.size} transaction(s) failed`,
        );
        if (mountedRef.current) {
          setSelectedIds(new Set());
        }
        fetchTransactions();
        return;
      }
      toast.success(
        `${selectedIds.size} transaction(s) ${
          action === 'approve' ? 'approved' : 'rejected'
        }`,
      );
      if (mountedRef.current) {
        setLastAction({ ids: Array.from(selectedIds), previousStates, action });
        setShowUndoToast(true);
        setTimeout(() => {
          if (mountedRef.current) setShowUndoToast(false);
        }, 5000);
        setSelectedIds(new Set());
      }
      fetchTransactions();
    } catch (err) {
      logger.error('Bulk action failed', { error: err });
    } finally {
      if (mountedRef.current) {
        setBulkLoading(false);
      }
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
            body: JSON.stringify({ id, action: 'REVERSE' }),
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
      if (mountedRef.current) {
        setLastAction(null);
        setShowUndoToast(false);
      }
      fetchTransactions();
    } catch {
      toast.error('Undo failed. Please try again.');
    } finally {
      if (mountedRef.current) {
        setBulkLoading(false);
      }
    }
  }

  // T-AR-SORT (Step 5): sort is now server-side via `?sortBy`/`?sortDir`.
  // The returned `transactions` is already in the requested order, so
  // `sorted` is just an alias. We keep the name so the table contract
  // (and the Ctrl-A "select pending on visible page" handler) doesn't
  // change shape.
  const sorted = transactions;

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

  // T-AR-SORT (Step 5): 3-state sort cycle (none → desc → asc → none),
  // matching the data-table primitive the rest of the admin uses.
  // First click picks the column and sorts desc (most useful default
  // for a finance list — newest/largest first), second click flips to
  // asc, third click clears and falls back to the API default order
  // (`createdAt desc`).
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'desc') {
        setSortDir('asc');
      } else if (sortDir === 'asc') {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
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
