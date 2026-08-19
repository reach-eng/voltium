'use client';

import { useWalletDeposits } from './wallet-deposits/useWalletDeposits';
import { exportWalletLedger } from './wallet-deposits/walletExport';
import { WalletHeader } from './wallet-deposits/WalletHeader';
import { WalletStatsCards } from './wallet-deposits/WalletStatsCards';
import { LedgerTable } from './wallet-deposits/LedgerTable';

/**
 * R3.7j split — Wallet deposits shell.
 *
 * Pre-split: 10.2 KB / 260 lines with 2-endpoint fetch + 3 stat cards
 * + table + CSV export all inline. Post-split: thin orchestrator that
 * wires the data hook, the export helper, and 3 subcomponents. Fetch
 * logic + filtering live in `useWalletDeposits` (2.6 KB); CSV builder
 * is a pure helper; the rest live in focused files under
 * `wallet-deposits/`.
 */
export default function WalletDepositManagement() {
  const w = useWalletDeposits();

  return (
    <div className="space-y-6">
      <WalletHeader
        searchTerm={w.searchTerm}
        setSearchTerm={w.setSearchTerm}
        loading={w.loading}
        onRefresh={w.fetchData}
        onExport={() => exportWalletLedger(w.filteredLedger)}
      />
      <WalletStatsCards stats={w.stats} />
      <LedgerTable
        loading={w.loading}
        ledger={w.filteredLedger}
        page={w.page}
        totalPages={w.totalPages}
        total={w.total}
        setPage={w.setPage}
      />
    </div>
  );
}
