'use client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import { getKycBadge } from '@/lib/admin-ui';
import { formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import type { KycRider } from './kyc-types';
import { getCompletion } from './kyc-types';

interface KycRowProps {
  rider: KycRider;
  isSelected: boolean;
  isRowLoading: boolean;
  onSelect: () => void;
  onView: () => void;
  onAction: (action: 'approve' | 'reject' | 'info_required') => void;
}

export function KycRow({
  rider,
  isSelected,
  isRowLoading,
  onSelect,
  onView,
  onAction,
}: KycRowProps) {
  const completion = getCompletion(rider);

  return (
    <TableRow className={isSelected ? 'bg-primary/5' : ''}>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{rider.fullName || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground font-mono">{rider.riderId}</p>
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
            <span className="text-xs text-muted-foreground">{rider.guarantorName}</span>
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
        <Badge variant="outline" className={`text-xs ${getKycBadge(rider.kycStatus)}`}>
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
        {rider.createdAt ? formatDateTimeDDMMYYYY(rider.createdAt) : '-'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={completion} className="h-2 w-16" />
          <span className="text-xs font-medium">{completion}%</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1 whitespace-nowrap min-w-[280px]">
          <Button variant="ghost" size="sm" onClick={onView} disabled={isRowLoading}>
            <Eye className="w-4 h-4" />
          </Button>
          {rider.kycStatus === 'PENDING' ||
          rider.kycStatus === 'SUBMITTED' ||
          rider.kycStatus === 'INFO_REQUIRED' ? (
            <>
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onAction('approve')}
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
                className="text-xs border-orange-500/30 text-orange-600"
                onClick={() => onAction('info_required')}
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
                variant="destructive"
                size="sm"
                className="text-xs"
                onClick={() => onAction('reject')}
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
          ) : (
            <span className="text-[10px] text-muted-foreground/40 font-medium px-2">
              {rider.kycStatus === 'APPROVED' ? '✓' : '✗'}
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
