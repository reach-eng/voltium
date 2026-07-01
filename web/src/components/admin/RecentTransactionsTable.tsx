'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndianRupee } from 'lucide-react';
import { useAdminStore } from '@/store/admin';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';

interface RecentTransaction {
  id: string;
  type: string;
  amount: number;
  purpose: string;
  status: string;
  createdAt: string;
  rider?: { fullName: string | null; name: string | null; riderId: string };
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return formatDateDDMMYYYY(dateStr);
}

interface RecentTransactionsTableProps {
  transactions: RecentTransaction[];
}

export default function RecentTransactionsTable({ transactions }: RecentTransactionsTableProps) {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);

  return (
    <Card
      className="rounded-2xl border-border/50 shadow-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-all"
      onClick={() => setActiveSection('transactions')}
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
                <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-semibold px-6">
                    {tx.rider?.fullName || tx.rider?.name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-sm font-bold ${tx.type === 'CREDIT' || tx.type === 'TOP_UP' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                    >
                      {tx.type === 'CREDIT' || tx.type === 'TOP_UP' ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-md text-[10px] font-bold ${
                        tx.status === 'SUCCESS' || tx.status === 'APPROVED'
                          ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                          : 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400'
                      }`}
                    >
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6 text-xs text-muted-foreground">
                    {formatDate(tx.createdAt)}
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
