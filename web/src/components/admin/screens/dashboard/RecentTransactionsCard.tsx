'use client';

import { IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  /** P1: role lacks transactions access — say so instead of "No recent". */
  accessDenied?: boolean;
}

function isCreditType(type: string | null | undefined): boolean {
  const t = type?.toUpperCase();
  return t === 'CREDIT' || t === 'TOP_UP' || t === 'REFUND' || t === 'REVERSAL' || t === 'BONUS';
}

function isDebitType(type: string | null | undefined): boolean {
  const t = type?.toUpperCase();
  return t === 'DEBIT' || t === 'WITHDRAWAL' || t === 'FEE' || t === 'PENALTY';
}

function getAmountClass(type: string | null | undefined): string {
  // P2: unknown/null types previously defaulted to debit red "-" (implied
  // money-out). Render neutrally when the direction is unrecognized.
  if (isCreditType(type)) return 'text-emerald-600 dark:text-emerald-400';
  if (isDebitType(type)) return 'text-rose-600 dark:text-rose-400';
  return 'text-muted-foreground';
}

function getAmountPrefix(type: string | null | undefined): string {
  if (isCreditType(type)) return '+';
  if (isDebitType(type)) return '-';
  return '';
}

function getStatusBadgeClass(status: string | null | undefined): string {
  const s = status?.toUpperCase();
  if (s === 'SUCCESS' || s === 'APPROVED' || s === 'COMPLETED') {
    return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
  }
  if (s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED') {
    return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
  }
  return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
}

/**
 * R3.7z split — Recent Transactions table card.
 */
export function RecentTransactionsCard({
  transactions,
  onCardClick,
  accessDenied = false,
}: RecentTransactionsCardProps) {
  return (
    // P1 a11y fix: was clickable card wrapping a <table> with
    // fake-interactive rows. Now a plain section with explicit action.
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden transition-all">
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-primary" />
          Recent Transactions
        </CardTitle>
        <CardAction>
          <button
            onClick={onCardClick}
            aria-label="View all transactions"
            className="text-xs font-medium text-primary hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            View all
          </button>
        </CardAction>
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
            {accessDenied ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  Your role has no access to transactions.
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  No recent transactions
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="transition-all duration-200 group"
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
                      {tx.status || '—'}
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
