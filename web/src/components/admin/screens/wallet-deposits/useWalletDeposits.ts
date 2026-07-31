'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EMPTY_WALLET_STATS, type LedgerEntry, type WalletStats } from './types';

/**
 * R3.7j split — Wallet deposits data hook.
 *
 * Fetches /api/admin/dashboard + /api/admin/transactions in parallel
 * and normalises the transaction list into LedgerEntry rows. The
 * mapping collapses TOP_UP into CREDIT (per the existing rule) and
 * falls back to "Rider"/"N/A" for missing rider fields.
 */
export function useWalletDeposits() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [stats, setStats] = useState<WalletStats>(EMPTY_WALLET_STATS);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, txRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/transactions?limit=50'),
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

      if (txRes.ok) {
        const txJson = await txRes.json();
        const rawList = txJson.data || [];
        const mapped: LedgerEntry[] = rawList.map((tx: any) => ({
          id: tx.id,
          riderName: tx.rider?.fullName || tx.rider?.name || 'Rider',
          riderId: tx.rider?.riderId || tx.riderId || 'N/A',
          type: tx.type === 'CREDIT' || tx.type === 'TOP_UP' ? 'CREDIT' : 'DEBIT',
          purpose: tx.purpose || tx.type || 'TRANSACTION',
          amount: typeof tx.amount === 'number' ? tx.amount : 0,
          createdAt: tx.createdAt || new Date().toISOString(),
        }));
        setLedger(mapped);
      }
    } catch (e) {
      toast.error('Failed to load wallet ledger data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLedger = ledger.filter(
    (l) =>
      l.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.riderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.purpose.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    ledger,
    filteredLedger,
    stats,
    loading,
    searchTerm,
    setSearchTerm,
    fetchData,
  };
}

export type WalletDepositsHook = ReturnType<typeof useWalletDeposits>;
