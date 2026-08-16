'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import type { WalletStats } from './types';

interface WalletStatsCardsProps {
  stats: WalletStats;
}

/**
 * R3.7j split — Three wallet stats cards.
 *
 * Total Wallet Float (primary, blue), Deposits Held (emerald), Pending
 * Approvals (rose). Each card shows a 2xl ₹ amount (or count) with
 * a small help line below.
 */
export function WalletStatsCards({ stats }: WalletStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Wallet Float</CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{stats.totalBalance.toLocaleString('en-IN')}</div>
          <p className="text-xs text-muted-foreground">Aggregated rider wallet funds</p>
        </CardContent>
      </Card>
      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Deposits Held</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">₹{stats.totalDeposits.toLocaleString('en-IN')}</div>
          <p className="text-xs text-muted-foreground">Active security deposit holdings</p>
        </CardContent>
      </Card>
      <Card className="bg-rose-500/5 border-rose-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
          <ArrowDownLeft className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingTransactions}</div>
          <p className="text-xs text-muted-foreground">Transactions awaiting review</p>
        </CardContent>
      </Card>
    </div>
  );
}
