'use client';

import { IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatDashboardDate,
  formatINR,
  transactionDisplayName,
  type RecentTransaction,
} from './types';

interface RecentTransactionsCardProps {
  transactions: RecentTransaction[];
  onCardClick: () => void;
}

function getAmountClass(type: string): string {
  if (type === 'CREDIT' || type === 'TOP_UP') {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  return 'text-rose-600 dark:text-rose-400';
}

function getAmountPrefix(type: string): string {
  return type === 'CREDIT' || type === 'TOP_UP' ? '+' : '-';
}

function getStatusBadgeClass(status: string): string {
  if (status === 'SUCCESS' || status === 'APPROVED') {
    return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
  }
  return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
}

/**
 * R3.7z split — Recent Transactions table card.
 */
export function RecentTransactionsCard({
  transactions,
  onCardClick,
}: RecentTransactionsCardProps) {
  return (
    <Card
      className="rounded-2xl border-border/50 shadow-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-all"
      onClick={onCardClick}
    >
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-primary" />
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="px-6">Rider</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-6 text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  No recent transactions
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="hover:bg-muted/50 cursor-pointer transition-all duration-200 group"
                >
                  <TableCell className="font-semibold px-6">
                    {transactionDisplayName(tx)}
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-bold ${getAmountClass(tx.type)}`}>
                      {getAmountPrefix(tx.type)}
                      {formatINR(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-md text-[10px] font-bold ${getStatusBadgeClass(tx.status)}`}
                    >
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6 text-xs text-muted-foreground">
                    {formatDashboardDate(tx.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
