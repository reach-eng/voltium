'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Referral } from './types';

interface ReferralsTableProps {
  loading: boolean;
  referrals: Referral[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Map of referee state → Tailwind badge class. */
function stateBadgeClass(state: string): string {
  if (state === 'ACTIVE' || state === 'POST_ACTIVE') {
    return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
  }
  if (state === 'SUSPENDED') {
    return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
  }
  return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
}

/**
 * R3.7o split — Referrals table + pagination.
 *
 * Six columns: Referrer (avatar + name + code), Referee (name + phone),
 * Payment Status (Paid/Active emerald or amber + rental line), KYC
 * Status (badge by state), Earning (₹ in emerald or muted dash), and
 * Action Date. Three render states: loading (centred spinner), empty
 * ("No records matching criteria"), and the populated table.
 */
export function ReferralsTable({
  loading,
  referrals,
  page,
  totalPages,
  onPageChange,
}: ReferralsTableProps) {
  return (
    <>
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Referrer (Code)
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Referred (Referee)
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Payment Status
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                KYC Status
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Earning (Referrer)
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Action Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow key="loading">
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Analyzing referral
                  data...
                </TableCell>
              </TableRow>
            )}
            {!loading && referrals.length === 0 && (
              <TableRow key="empty">
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground font-medium"
                >
                  No records matching criteria.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              referrals.length > 0 &&
              referrals.map((r) => (
                <TableRow key={r.refereeId} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                        {(r.referrerName || 'U')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{r.referrerName || 'Unknown Referrer'}</p>
                        <p className="text-[10px] text-primary font-black font-mono tracking-widest">
                          {r.referrerCode || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-bold text-sm">{r.refereeName}</p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {r.refereePhone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-black uppercase tracking-tight ${r.refereeLifecycleStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}`}
                      >
                        {r.refereeLifecycleStatus === 'ACTIVE' ? 'Paid & Active' : 'No Active Plan'}
                      </span>
                      {r.refereeRentalStatus && (
                        <span className="text-[9px] font-medium text-muted-foreground">
                          Rental: {r.refereeRentalStatus}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black uppercase px-2 py-0.5 ${stateBadgeClass(r.refereeState)}`}
                    >
                      {r.refereeState}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p
                      className={`text-sm font-black ${r.earningForReferrer > 0 ? 'text-emerald-600' : 'text-muted-foreground/40'}`}
                    >
                      {r.earningForReferrer > 0 ? `₹${r.earningForReferrer}` : '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[11px] font-medium">
                    {formatDateDDMMYYYY(r.referredAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm font-medium px-2">{page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </>
  );
}
