'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EMPTY_WALLET_STATS, type LedgerEntry, type WalletStats } from './types';

/**
 * R3.7j split — Wallet deposits data hook with server-side pagination.
 *
 * Fetches /api/admin/dashboard + /api/admin/transactions + /api/admin/deposits
 * in parallel and normalises into LedgerEntry rows.
 */
export function useWalletDeposits() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [stats, setStats] = useState<WalletStats>(EMPTY_WALLET_STATS);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset to page 1 on search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
      const [statsRes, txRes, depositsRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch(`/api/admin/transactions?page=${page}&limit=${limit}${searchParam}`),
        fetch(`/api/admin/deposits?page=${page}&limit=${limit}${searchParam}`),
      ]);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.data) {
          setStats({
            totalBalance: statsJson.data.totalBalance || 0,
            totalDeposits: statsJson.data.totalDeposits || 0,
            pendingTransactions: statsJson.data.pendingTransactions || 0,
          });
        }
      }

      const combined: LedgerEntry[] = [];
      let maxTotal = 0;
      let maxPages = 1;

      if (depositsRes.ok) {
        const depJson = await depositsRes.json();
        const depList = depJson.data || [];
        if (depJson.pagination) {
          maxTotal += depJson.pagination.total || 0;
          maxPages = Math.max(maxPages, depJson.pagination.totalPages || 1);
        }
        depList.forEach((dep: any) => {
          combined.push({
            id: dep.id,
            riderName: dep.rider?.fullName || dep.rider?.name || 'Rider',
            riderId: dep.rider?.riderId || dep.riderId || 'N/A',
            type: 'CREDIT',
            purpose: `SECURITY_DEPOSIT (${dep.status || 'PENDING'})`,
            amount: typeof dep.amount === 'number' ? dep.amount : 0,
            createdAt: dep.createdAt || new Date().toISOString(),
          });
        });
      }

      if (txRes.ok) {
        const txJson = await txRes.json();
        const rawList = txJson.data || [];
        if (txJson.pagination) {
          maxTotal += txJson.pagination.total || 0;
          maxPages = Math.max(maxPages, txJson.pagination.totalPages || 1);
        }
        rawList.forEach((tx: any) => {
          combined.push({
            id: tx.id,
            riderName: tx.rider?.fullName || tx.rider?.name || 'Rider',
            riderId: tx.rider?.riderId || tx.riderId || 'N/A',
            type: tx.type === 'CREDIT' || tx.type === 'TOP_UP' ? 'CREDIT' : 'DEBIT',
            purpose: tx.purpose || tx.type || 'TRANSACTION',
            amount: typeof tx.amount === 'number' ? tx.amount : 0,
            createdAt: tx.createdAt || new Date().toISOString(),
          });
        });
      }

      // Sort by date descending
      combined.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setLedger(combined);
      setTotal(maxTotal);
      setTotalPages(maxPages);
    } catch (e) {
      toast.error('Failed to load wallet ledger data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ledger,
    filteredLedger: ledger,
    stats,
    loading,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    totalPages,
    total,
    fetchData,
  };
}

export type WalletDepositsHook = ReturnType<typeof useWalletDeposits>;
