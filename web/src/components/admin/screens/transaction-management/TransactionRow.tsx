import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { Eye, CheckCircle, XCircle as XCircleIcon } from 'lucide-react';
import { Transaction, formatINR, formatDate, getTransactionColors } from './types';

interface TransactionRowProps {
  tx: Transaction;
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onViewDetails: (tx: Transaction) => void;
  onSetConfirmAction: (tx: Transaction, action: 'approve' | 'reject') => void;
}

export function TransactionRow({
  tx,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onSetConfirmAction,
}: TransactionRowProps) {
  const { badgeColor, amountColor, statusBadgeColor, isCredit } = getTransactionColors(tx);

  return (
    <TableRow className={isSelected ? 'bg-primary/5' : ''}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onToggleSelect(tx.id, !!checked)}
        />
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {tx.id.substring(0, 8)}...
      </TableCell>
      <TableCell className="text-sm">
        {tx.rider?.fullName || tx.rider?.name || 'Unknown'}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] font-black uppercase tracking-tight ${badgeColor}`}
        >
          {tx.type}
        </Badge>
      </TableCell>
      <TableCell className={`font-black text-sm ${amountColor}`}>
        {isCredit ? '+' : '-'}
        {formatINR(tx.amount)}
      </TableCell>
      <TableCell className="text-xs">
        <div className="flex flex-col gap-1">
          <span>{(tx.purpose || '').replace('_', ' ')}</span>
          {tx.breakdowns && tx.breakdowns.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1 p-1 bg-muted/20 rounded">
              {tx.breakdowns.map((item, idx) => (
                <div key={idx} className="flex justify-between w-32">
                  <span>{item.item}:</span>
                  <span className="font-mono">{formatINR(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {tx.method || '-'}
      </TableCell>
      <TableCell>
        {tx.proofUrl ? (
          <div
            className="w-8 h-8 rounded border overflow-hidden bg-muted cursor-pointer hover:scale-110 transition-transform"
            onClick={() => onViewDetails(tx)}
          >
            <img src={tx.proofUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] font-black uppercase tracking-tight ${statusBadgeColor}`}
        >
          {tx.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(tx.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => onViewDetails(tx)}
            title="View Details"
            aria-label="View transaction details"
          >
            <Eye className="w-5 h-5" />
          </Button>
          {tx.status === 'PENDING' && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => onSetConfirmAction(tx, 'approve')}
                title="Approve"
                aria-label="Approve transaction"
              >
                <CheckCircle className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                onClick={() => onSetConfirmAction(tx, 'reject')}
                title="Reject"
                aria-label="Reject transaction"
              >
                <XCircleIcon className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
