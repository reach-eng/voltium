'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Eye,
  Loader2,
} from 'lucide-react';
import { getCompletion, getKycBadge } from './helpers';
import { formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import type { KycRider, KycConfirmAction } from './types';

export interface KycTableProps {
  filteredRiders: KycRider[];
  loading: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  rowLoadingIds: Set<string>;
  setSelectedRider: (rider: KycRider) => void;
  setConfirmAction: (action: KycConfirmAction | null) => void;
}

export function KycTable({
  filteredRiders,
  loading,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  rowLoadingIds,
  setSelectedRider,
  setConfirmAction,
}: KycTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (filteredRiders.length === 0) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">No riders found for this filter</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm overflow-x-auto">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    filteredRiders.length > 0 && selectedIds.size === filteredRiders.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Rider</TableHead>
              <TableHead>Guarantor</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead>Aadhaar</TableHead>
              <TableHead>PAN</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Signature</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead
                className="text-right whitespace-nowrap"
                style={{ minWidth: '280px' }}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRiders.map((rider) => {
              const completion = getCompletion(rider);
              const isRowLoading = rowLoadingIds.has(rider.id);
              return (
                <TableRow
                  key={rider.id}
                  className={selectedIds.has(rider.id) ? 'bg-primary/5' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(rider.id)}
                      onCheckedChange={() => toggleSelect(rider.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{rider.fullName || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {rider.riderId}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {rider.guarantorName ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 text-[10px]"
                          >
                            Yes
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {rider.guarantorName}
                        </span>
                        {rider.sharedGuarantorWith?.length > 0 && (
                          <Badge className="bg-amber-500 hover:bg-amber-600 border-none text-[8px] py-0 px-1 w-fit uppercase font-black">
                            Shared ({rider.sharedGuarantorWith.length})
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{rider.phone}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getKycBadge(rider.kycStatus)}`}
                    >
                      {rider.kycStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rider.aadhaarFront && rider.aadhaarBack ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    {rider.panCard ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    {rider.accountNumber ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    {rider.signature ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {rider.createdAt
                      ? formatDateTimeDDMMYYYY(rider.createdAt)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={completion} className="h-2 w-16" />
                      <span className="text-xs font-medium">{completion}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap min-w-[280px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRider(rider)}
                        disabled={isRowLoading}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {rider.kycStatus === 'PENDING' ||
                      rider.kycStatus === 'SUBMITTED' ||
                      rider.kycStatus === 'INFO_REQUIRED' ? (
                        <>
                          <Button
                            size="sm"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setConfirmAction({ rider, action: 'approve' })}
                            title="Approve"
                            disabled={isRowLoading}
                          >
                            {isRowLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-orange-500/30 text-orange-600 dark:text-orange-400"
                            onClick={() =>
                              setConfirmAction({ rider, action: 'info_required' })
                            }
                            title="Needs Correction"
                            disabled={isRowLoading}
                          >
                            {isRowLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ShieldAlert className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs"
                            onClick={() => setConfirmAction({ rider, action: 'reject' })}
                            title="Reject"
                            disabled={isRowLoading}
                          >
                            {isRowLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ShieldX className="w-3 h-3" />
                            )}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
