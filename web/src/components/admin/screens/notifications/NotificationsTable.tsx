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
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Notification } from './types';
import { TYPE_COLORS, TYPE_COLOR_FALLBACK } from './types';

interface NotificationsTableProps {
  notifications: Notification[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

/**
 * R3.7f split — Notifications table + pagination.
 *
 * Five columns: rider (name + ID), title (truncated message), type
 * (color-coded badge), read state (icon badge), date. Pagination only
 * renders when there are multiple pages; both prev/next buttons
 * disable at the boundaries.
 */
export function NotificationsTable({
  notifications,
  loading,
  page,
  totalPages,
  totalCount,
  onPageChange,
}: NotificationsTableProps) {
  return (
    <>
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rider</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No notifications found
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{n.riderName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{n.riderId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {n.message}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase ${TYPE_COLORS[n.type] || TYPE_COLOR_FALLBACK}`}
                    >
                      {n.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        n.isRead
                          ? 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                          : 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400'
                      }`}
                    >
                      {n.isRead ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-0.5" /> Read
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-0.5" /> Unread
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateDDMMYYYY(n.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {totalCount} notifications
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
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
      )}
    </>
  );
}
