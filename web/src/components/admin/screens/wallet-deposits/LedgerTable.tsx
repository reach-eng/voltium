'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { LedgerEntry } from './types';

interface LedgerTableProps {
  loading: boolean;
  ledger: LedgerEntry[];
}

/**
 * R3.7j split — Double-entry ledger table.
 *
 * Five columns: Rider (name + ID), Type badge (CREDIT = emerald, DEBIT
 * = destructive), Purpose, Amount (₹), Date. Three render states:
 * skeleton (5 rows with placeholder widths), empty (single line), or
 * the populated table.
 */
export function LedgerTable({ loading, ledger }: LedgerTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Double-Entry Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LedgerSkeleton />
        ) : ledger.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No ledger entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left font-medium text-muted-foreground">
                  <th className="pb-3">Rider</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Purpose</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledger.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/50">
                    <td className="py-3 font-medium">
                      <div>{l.riderName}</div>
                      <div className="text-xs text-muted-foreground">ID: {l.riderId}</div>
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={l.type === 'CREDIT' ? 'default' : 'destructive'}
                        className={l.type === 'CREDIT' ? 'bg-emerald-600 text-white' : ''}
                      >
                        {l.type}
                      </Badge>
                    </td>
                    <td className="py-3 font-semibold">{l.purpose}</td>
                    <td className="py-3">₹{l.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {new Date(l.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Skeleton placeholder for the ledger table. */
function LedgerSkeleton() {
  return (
    <div className="overflow-x-auto animate-in fade-in duration-500">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {['Rider', 'Type', 'Purpose', 'Amount', 'Date'].map((h) => (
              <th key={h} className="pb-3 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...Array(5)].map((_, i) => (
            <tr key={i}>
              <td className="py-3">
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-20" />
              </td>
              <td className="py-3">
                <Skeleton className="h-5 w-16 rounded-full" />
              </td>
              <td className="py-3">
                <Skeleton className="h-4 w-24" />
              </td>
              <td className="py-3">
                <Skeleton className="h-4 w-16" />
              </td>
              <td className="py-3 text-right">
                <Skeleton className="h-4 w-20 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
