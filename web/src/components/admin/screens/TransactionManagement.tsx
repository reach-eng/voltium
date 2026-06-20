'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import WalletDepositManagement from './WalletDepositManagement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeftRight,
  Eye,
  CheckCircle,
  XCircle as XCircleIcon,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Undo2,
  X,
  Loader2,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { ExportButton } from '../export-button';
import { AdminErrorBoundary } from '../error-boundary';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  purpose: string;
  method: string | null;
  status: string;
  reason: string | null;
  remark: string | null;
  description: string | null;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  proofUrl: string | null;
  rider?: {
    id: string;
    riderId: string;
    fullName: string | null;
    name: string | null;
    phone: string;
  };
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Shared color logic ──────────────────────────────────────────────
function getTransactionColors(tx: Transaction) {
  const isCredit = tx.type === 'CREDIT' || tx.type === 'TOP_UP';
  const status = (tx.status || '').toUpperCase();
  const purpose = (tx.purpose || '').toUpperCase();

  let badgeColor = 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
  let amountColor = 'text-amber-600 dark:text-amber-400';
  let statusBadgeColor = 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';

  if (status === 'REJECTED' || status === 'FAILED') {
    badgeColor = 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    amountColor = 'text-rose-600 dark:text-rose-400';
    statusBadgeColor = 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
  } else if (status === 'APPROVED' || status === 'SUCCESS') {
    if (purpose.includes('REWARD')) {
      badgeColor = 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
      amountColor = 'text-orange-600 dark:text-orange-400';
    } else if (purpose.includes('REFUND')) {
      badgeColor = 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
      amountColor = 'text-blue-600 dark:text-blue-400';
    } else {
      badgeColor = 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
      amountColor = 'text-emerald-600 dark:text-emerald-400';
    }
    statusBadgeColor =
      'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
  }

  if (!isCredit) {
    amountColor = 'text-rose-600 dark:text-rose-400';
  }

  return { badgeColor, amountColor, statusBadgeColor, isCredit };
}

export default function TransactionManagement() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    tx: Transaction;
    action: 'approve' | 'reject';
  } | null>(null);
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
  const [lastAction, setLastAction] = useState<{
    ids: string[];
    previousStates: Record<string, any>;
    action: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [bulkRejectDialog, setBulkRejectDialog] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [creditWallet, setCreditWallet] = useState(false);
  const [walletCreditAmount, setWalletCreditAmount] = useState(0);
  const mountedRef = useRef(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === 'TOP_UP') {
        params.set('type', 'TOP_UP');
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

  // Debounce search
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
  }

  async function handleBulkAction(action: 'approve' | 'reject', reason?: string) {
    if (selectedIds.size === 0) return;
    const previousStates: Record<string, any> = {};
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
  }

  const sorted = sortKey
    ? [...transactions].sort((a, b) => {
        const aVal = a[sortKey as keyof Transaction] ?? '';
        const bVal = b[sortKey as keyof Transaction] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : transactions;

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
  }, [sorted, lastAction, bulkLoading]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <AdminErrorBoundary>
      {/* ── Section heading + outer tab switcher ── */}
      <div className="flex flex-col gap-1 mb-2">
        <h2 className="text-2xl font-bold tracking-tight">Finance</h2>
        <p className="text-muted-foreground text-sm">Manage payments, top-ups, wallet balances, and security deposits.</p>
      </div>
      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="transactions" className="text-xs px-5 font-semibold">
            Payments &amp; Top-ups
          </TabsTrigger>
          <TabsTrigger value="wallet" className="text-xs px-5 font-semibold">
            Wallet &amp; Deposits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-0">
      <div className="space-y-6">
        <div className="flex justify-end">
          <ExportButton
            data={transactions.map((tx) => ({
              id: tx.id,
              riderName: tx.rider?.fullName || tx.rider?.name,
              riderPhone: tx.rider?.phone,
              type: tx.type,
              amount: tx.amount,
              purpose: tx.purpose,
              method: tx.method,
              status: tx.status,
              reason: tx.reason,
              createdAt: tx.createdAt,
            }))}
            filename="transactions"
            columns={[
              { key: 'id', label: 'Transaction ID' },
              { key: 'riderName', label: 'Rider Name' },
              { key: 'riderPhone', label: 'Rider Phone' },
              { key: 'type', label: 'Type' },
              { key: 'amount', label: 'Amount' },
              { key: 'purpose', label: 'Purpose' },
              { key: 'method', label: 'Method' },
              { key: 'status', label: 'Status' },
              { key: 'reason', label: 'Reason' },
              { key: 'createdAt', label: 'Date' },
            ]}
          />
        </div>

        {/* Tab Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-muted/30 p-1">
              <TabsTrigger value="all" className="text-xs px-4">
                All
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs px-4">
                Pending
              </TabsTrigger>
              <TabsTrigger value="TOP_UP" className="text-xs px-4">
                Top-ups
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs px-4">
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs px-4">
                Rejected
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search rider or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
              />
            </div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
            {(search || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setSearch('');
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Transaction Table */}
        <Card className="rounded-xl shadow-sm overflow-hidden border border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ArrowLeftRight className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">No transactions found</p>
              </div>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-1 p-2 bg-primary/5 border-b border-primary/20">
                    <span className="text-xs px-2 font-medium text-primary">
                      {selectedIds.size} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                      disabled={bulkLoading}
                      onClick={() => handleBulkAction('approve')}
                      title="Approve All"
                    >
                      {bulkLoading ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}{' '}
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                      disabled={bulkLoading}
                      onClick={() => setBulkRejectDialog(true)}
                      title="Reject All"
                    >
                      <XCircleIcon className="w-3 h-3 mr-1" /> Reject
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 hover:bg-muted-foreground/10 transition-all duration-200"
                      onClick={() => {
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
                        link.setAttribute(
                          'download',
                          `transactions-${new Date().toISOString().split('T')[0]}.csv`
                        );
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" /> Export
                    </Button>
                    {lastAction && (
                      <>
                        <div className="w-px h-4 bg-border/50 mx-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 hover:bg-muted/10 transition-all duration-200"
                          disabled={bulkLoading}
                          onClick={handleUndo}
                          title="Undo (Ctrl+Z)"
                        >
                          <Undo2 className="w-3 h-3 mr-1" /> Undo
                        </Button>
                      </>
                    )}
                    <div className="w-px h-4 bg-border/50 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-muted-foreground/10"
                      onClick={() => setSelectedIds(new Set())}
                      title="Clear selection"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            sorted.filter((tx) => tx.status === 'PENDING').length > 0 &&
                            selectedIds.size ===
                              sorted.filter((tx) => tx.status === 'PENDING').length
                          }
                          onCheckedChange={(checked) => {
                            const pending = sorted.filter((tx) => tx.status === 'PENDING');
                            setSelectedIds(
                              checked ? new Set(pending.map((tx) => tx.id)) : new Set()
                            );
                          }}
                        />
                      </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Rider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('amount')}
                      >
                        Amount {sortKey === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Proof</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('createdAt')}
                      >
                        Date {sortKey === 'createdAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((tx) => {
                      const { badgeColor, amountColor, statusBadgeColor, isCredit } =
                        getTransactionColors(tx);

                      return (
                        <TableRow
                          key={tx.id}
                          className={selectedIds.has(tx.id) ? 'bg-primary/5' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(tx.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds);
                                if (checked) next.add(tx.id);
                                else next.delete(tx.id);
                                setSelectedIds(next);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {tx.id.substring(0, 8)}...
                          </TableCell>
                          <TableCell className="text-sm">
                            {tx.rider?.fullName || tx.rider?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-black uppercase tracking-tight ${badgeColor}`}
                            >
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`font-black text-sm ${amountColor}`}>
                            {isCredit ? '+' : '-'}
                            {formatINR(tx.amount)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {(tx.purpose || '').replace('_', ' ')}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tx.method || '-'}
                          </TableCell>
                          <TableCell>
                            {tx.proofUrl ? (
                              <div
                                className="w-8 h-8 rounded border overflow-hidden bg-muted cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => setSelectedTx(tx)}
                              >
                                <img
                                  src={tx.proofUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-black uppercase tracking-tight ${statusBadgeColor}`}
                            >
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(tx.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTx(tx)}
                                title="View Details"
                                aria-label="View transaction details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {tx.status === 'PENDING' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                    onClick={() => setConfirmAction({ tx, action: 'approve' })}
                                    title="Approve"
                                    aria-label="Approve transaction"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                    onClick={() => setConfirmAction({ tx, action: 'reject' })}
                                    title="Reject"
                                    aria-label="Reject transaction"
                                  >
                                    <XCircleIcon className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} transactions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Transaction Details Dialog */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            {selectedTx &&
              (() => {
                const { badgeColor, amountColor, statusBadgeColor, isCredit } =
                  getTransactionColors(selectedTx);
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Transaction ID</p>
                        <p className="text-sm font-mono">{selectedTx.id.substring(0, 12)}...</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge
                          variant="outline"
                          className={`text-xs font-black uppercase tracking-tight ${statusBadgeColor}`}
                        >
                          {selectedTx.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Rider</p>
                        <p className="text-sm font-medium">
                          {selectedTx.rider?.fullName || selectedTx.rider?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">{selectedTx.rider?.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className={`text-lg font-bold ${amountColor}`}>
                          {isCredit ? '+' : '-'}
                          {formatINR(selectedTx.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="text-sm">{selectedTx.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Purpose</p>
                        <p className="text-sm">{(selectedTx.purpose || '').replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Method</p>
                        <p className="text-sm">{selectedTx.method || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm">{formatDate(selectedTx.createdAt)}</p>
                      </div>
                    </div>

                    {selectedTx.reason && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Reason</p>
                        <p className="text-sm">{selectedTx.reason}</p>
                      </div>
                    )}
                    {selectedTx.description && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Description</p>
                        <p className="text-sm">{selectedTx.description}</p>
                      </div>
                    )}
                    {selectedTx.rejectionReason && (
                      <div className="bg-rose-500/5 rounded-lg p-3 border border-rose-500/20">
                        <p className="text-xs text-rose-600 dark:text-rose-400">Rejection Reason</p>
                        <p className="text-sm text-rose-700 dark:text-rose-400">
                          {selectedTx.rejectionReason}
                        </p>
                      </div>
                    )}
                    {selectedTx.approvedAt && (
                      <div className="bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/20">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          Approved At
                        </p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                          {formatDate(selectedTx.approvedAt)}
                        </p>
                      </div>
                    )}

                    {selectedTx.proofUrl && (
                      <div className="space-y-2 pt-2 border-t mt-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Proof of Transaction
                        </p>
                        <div className="aspect-[3/4] w-full rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center group relative">
                          <img
                            src={selectedTx.proofUrl}
                            alt="Transaction Proof"
                            className="w-full h-full object-contain transition-transform group-hover:scale-105"
                          />
                          <a
                            href={selectedTx.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                          >
                            <Button variant="secondary" size="sm" className="gap-2">
                              <Download className="w-4 h-4" />
                              Download Original
                            </Button>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
          </DialogContent>
        </Dialog>

        {/* Confirm Action Dialog */}
        <AlertDialog
          open={!!confirmAction}
          onOpenChange={() => {
            setConfirmAction(null);
            setCreditWallet(false);
            setWalletCreditAmount(0);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.action === 'approve' ? 'Approve Transaction' : 'Reject Transaction'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.action === 'approve' ? (
                  <div className="space-y-4">
                    <p>
                      Are you sure you want to approve this transaction for{' '}
                      <strong>{formatINR(confirmAction?.tx.amount || 0)}</strong>?
                    </p>
                    {confirmAction?.tx.purpose === 'SECURITY_DEPOSIT' && (
                      <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={creditWallet}
                            onChange={(e) => {
                              setCreditWallet(e.target.checked);
                              if (e.target.checked)
                                setWalletCreditAmount(
                                  confirmAction?.tx.amount
                                    ? Math.round(confirmAction.tx.amount / 100)
                                    : 0
                                );
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm font-medium">
                            Also add amount to wallet balance?
                          </span>
                        </label>
                        {creditWallet && (
                          <div className="flex items-center gap-2 pl-7">
                            <span className="text-sm font-semibold text-muted-foreground">₹</span>
                            <input
                              type="number"
                              min={1}
                              value={walletCreditAmount}
                              onChange={(e) =>
                                setWalletCreditAmount(Math.max(1, Number(e.target.value)))
                              }
                              className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-xs text-muted-foreground">will be credited</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    Are you sure you want to reject this transaction for{' '}
                    <strong>{formatINR(confirmAction?.tx.amount || 0)}</strong>?
                    <textarea
                      className="w-full mt-3 p-2 border rounded-md text-sm"
                      placeholder="Rejection reason..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAction}
                disabled={actionLoading}
                className={
                  confirmAction?.action === 'reject'
                    ? 'bg-destructive text-destructive-foreground'
                    : ''
                }
              >
                {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                {confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Reject Dialog */}
        <Dialog open={bulkRejectDialog} onOpenChange={setBulkRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject {selectedIds.size} Transactions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <textarea
                  className="w-full min-h-[100px] p-3 border rounded-lg text-sm resize-none"
                  placeholder="Enter rejection reason..."
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkRejectDialog(false);
                  setBulkRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleBulkAction('reject', bulkRejectReason);
                  setBulkRejectDialog(false);
                  setBulkRejectReason('');
                }}
              >
                Reject All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showUndoToast && lastAction && (
          <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <span className="text-sm">{lastAction.ids.length} transaction(s) updated</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 hover:bg-background/20 text-background"
              disabled={bulkLoading}
              onClick={handleUndo}
            >
              <Undo2 className="w-3 h-3 mr-1" /> Undo
            </Button>
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="wallet">
          <WalletDepositManagement />
        </TabsContent>
      </Tabs>
    </AdminErrorBoundary>
  );
}
