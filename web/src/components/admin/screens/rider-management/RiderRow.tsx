import { TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2, ShieldAlert, Bike } from 'lucide-react';
import { getKycBadge } from './helpers';
import { formatDateTimeDDMMYYYY, formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Rider } from '@/lib/types/admin';
import React, { useRef, useState, useEffect } from 'react';

interface RiderRowProps {
  rider: Rider;
  isSelected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onViewDetails: () => void;
  onDelete: () => void;
}

export const RiderRow = React.memo(function RiderRow({
  rider,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onDelete,
}: RiderRowProps) {
  const isActive = rider.lifecycleStatus === 'ACTIVE';
  const isRed =
    rider.lifecycleStatus === 'SUSPENDED' || rider.lifecycleStatus === 'CLOSED';
  const isOrange =
    rider.lifecycleStatus === 'KYC_SUBMITTED' ||
    rider.lifecycleStatus === 'PROFILE_SUBMITTED';
  const nameColor = isRed
    ? 'text-rose-600 dark:text-rose-400'
    : isActive
      ? 'text-emerald-600 dark:text-emerald-400'
      : isOrange
        ? 'text-orange-500'
        : 'text-foreground';

  // Defer rendering of action buttons until the row enters the viewport.
  // All layout cells render immediately; only the interactive action cell is deferred.
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [actionsVisible, setActionsVisible] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActionsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <TableRow
      ref={rowRef}
      className={`hover:bg-muted/30 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}
    >
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </TableCell>
      <TableCell>
        <div>
          <p className={`font-semibold flex items-center gap-2 ${nameColor}`}>
            {rider.fullName || '—'}
            {rider.sharedGuarantorWith && Array.isArray(rider.sharedGuarantorWith) && rider.sharedGuarantorWith.length > 0 && (
              <span title="Shared guarantor detected">
                <ShieldAlert className="w-3 h-3 text-rose-500" />
              </span>
            )}
          </p>
        </div>
      </TableCell>
      <TableCell className="text-sm">{rider.phone}</TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {rider.createdAt ? formatDateTimeDDMMYYYY(rider.createdAt) : '—'}
      </TableCell>
      <TableCell className="text-xs font-medium">
        {rider.activeVehicle ? (
          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Bike className="w-3 h-3" /> {rider.activeVehicle}
          </span>
        ) : (
          <span className="text-muted-foreground italic">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {rider.pickedUpAt ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {formatDateDDMMYYYY(rider.pickedUpAt)}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Pending</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] uppercase font-black tracking-widest ${getKycBadge((rider.kycStatus as string) ?? 'PENDING')}`}
        >
          {rider.kycStatus ?? 'PENDING'}
        </Badge>
      </TableCell>
      <TableCell className="font-semibold text-sm">
        ₹{(rider.walletBalance || 0).toLocaleString('en-IN')}
      </TableCell>
      <TableCell className="text-right">
        {actionsVisible ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg bg-blue-500/5 hover:bg-blue-500/10"
              onClick={onViewDetails}
              title="View Details"
            >
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              onClick={onDelete}
              title="Remove Rider"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="w-[72px] h-8" aria-hidden />
        )}
      </TableCell>
    </TableRow>
  );
});
