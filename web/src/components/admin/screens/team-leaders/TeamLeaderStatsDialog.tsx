'use client';

import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TeamLeaderStatsPayload } from './types';

interface TeamLeaderStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  payload: TeamLeaderStatsPayload | null;
}

interface StatTileProps {
  label: string;
  value: number;
  bgClass: string;
  borderClass: string;
  valueClass?: string;
}

function StatTile({ label, value, bgClass, borderClass, valueClass }: StatTileProps) {
  return (
    <div
      className={`${bgClass} p-4 rounded-xl border ${borderClass} text-center`}
    >
      <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black mt-1 ${valueClass || ''}`}>{value}</p>
    </div>
  );
}

function formatRupees(balance: number): string {
  return `₹${(balance / 100).toFixed(2)}`;
}

function getBalanceClass(rider: {
  isOverdue?: boolean;
  isUpcoming?: boolean;
}): string {
  if (rider.isOverdue) return 'text-destructive';
  if (rider.isUpcoming) return 'text-orange-500';
  return 'text-emerald-500';
}

/**
 * R3.7aa split — Drivers & Stats modal for a single team leader.
 */
export function TeamLeaderStatsDialog({
  open,
  onOpenChange,
  loading,
  payload,
}: TeamLeaderStatsDialogProps) {
  const title = payload
    ? `${payload.leader.name}'s Drivers & Stats`
    : 'Drivers & Stats';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : payload ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatTile
                  label="Total Riders"
                  value={payload.data.stats.totalRiders}
                  bgClass="bg-primary/5"
                  borderClass="border-primary/20"
                />
                <StatTile
                  label="Churned"
                  value={payload.data.stats.churned}
                  bgClass="bg-destructive/5"
                  borderClass="border-destructive/20"
                  valueClass="text-destructive"
                />
                <StatTile
                  label="Overdue Rent"
                  value={payload.data.stats.overdueRent}
                  bgClass="bg-red-500/5"
                  borderClass="border-red-500/20"
                  valueClass="text-red-600 dark:text-red-400"
                />
                <StatTile
                  label="Upcoming Rent"
                  value={payload.data.stats.upcomingRent}
                  bgClass="bg-orange-500/5"
                  borderClass="border-orange-500/20"
                  valueClass="text-orange-600 dark:text-orange-400"
                />
                <StatTile
                  label="Timely Rent"
                  value={payload.data.stats.timelyRent}
                  bgClass="bg-emerald-500/5"
                  borderClass="border-emerald-500/20"
                  valueClass="text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div>
                <h3 className="text-lg font-bold mb-3">Drivers List</h3>
                <div className="rounded-xl border shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-xs uppercase font-medium text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Rider</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Wallet Balance</th>
                        <th className="px-4 py-3">Scooter Overdue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payload.data.riders.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {r.fullName || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.riderId} • {r.phone}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{r.lifecycleStatus}</Badge>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <span className={getBalanceClass(r)}>
                              {formatRupees(r.balance)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.hasOverdueScooter ? (
                              <Badge variant="destructive">Yes</Badge>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {payload.data.riders.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No riders found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
