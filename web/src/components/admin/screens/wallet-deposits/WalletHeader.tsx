'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileDown, RefreshCw, Search } from 'lucide-react';

interface WalletHeaderProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
}

/**
 * R3.7j split — Wallet deposits tab header.
 *
 * H2 + subtitle on the left, search input + refresh icon button +
 * Export CSV button on the right. The search hits the local ledger
 * filter (no API round-trip), so it stays in the data hook.
 */
export function WalletHeader({
  searchTerm,
  setSearchTerm,
  loading,
  onRefresh,
  onExport,
}: WalletHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wallet &amp; Deposits</h2>
        <p className="text-muted-foreground">
          Audit double-entry ledgers, security deposits, and adjustments.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ledger entries..."
            className="pl-8 h-11 text-base rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-xl"
          onClick={onRefresh}
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="outline"
          size="default"
          className="gap-2 h-11 px-5 rounded-xl"
          onClick={onExport}
        >
          <FileDown className="h-4 w-4" /> Export CSV
        </Button>
      </div>
    </div>
  );
}
