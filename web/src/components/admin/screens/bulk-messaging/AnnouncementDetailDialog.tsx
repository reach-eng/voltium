'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatAnnouncementDate,
  getStatusBadgeClass,
  type Announcement,
} from './types';

interface AnnouncementDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement | null;
}

/**
 * R3.7x split — read-only detail dialog with delivery breakdown table.
 */
export function AnnouncementDetailDialog({
  open,
  onOpenChange,
  announcement,
}: AnnouncementDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{announcement?.title}</DialogTitle>
        </DialogHeader>
        {announcement && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`rounded-md text-xs font-bold uppercase ${getStatusBadgeClass(announcement.status)}`}
              >
                {announcement.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {announcement.channel.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{announcement.message}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target</span>
                <span>{announcement.targetAudience.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Recipients</span>
                <span className="font-semibold">{announcement.totalRecipients}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivered</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {announcement.deliveredCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Read</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {announcement.readCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {announcement.failedCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatAnnouncementDate(announcement.createdAt)}</span>
              </div>
              {announcement.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent At</span>
                  <span>{formatAnnouncementDate(announcement.sentAt)}</span>
                </div>
              )}
              {announcement.scheduledAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled For</span>
                  <span>{formatAnnouncementDate(announcement.scheduledAt)}</span>
                </div>
              )}
            </div>

            <Card className="rounded-xl border-border/50">
              <CardHeader className="pb-2 px-4 pt-3">
                <CardTitle className="text-sm font-bold">Delivery Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 py-1">Status</TableHead>
                      <TableHead className="text-right px-2 py-1">Count</TableHead>
                      <TableHead className="text-right px-2 py-1">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <DeliveryRow
                      label="Delivered"
                      count={announcement.deliveredCount}
                      total={announcement.totalRecipients}
                      colorClass="text-emerald-600 dark:text-emerald-400"
                    />
                    <DeliveryRow
                      label="Read"
                      count={announcement.readCount}
                      total={announcement.totalRecipients}
                      colorClass="text-blue-600 dark:text-blue-400"
                    />
                    <DeliveryRow
                      label="Failed"
                      count={announcement.failedCount}
                      total={announcement.totalRecipients}
                      colorClass="text-rose-600 dark:text-rose-400"
                    />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeliveryRowProps {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}

function DeliveryRow({ label, count, total, colorClass }: DeliveryRowProps) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
  return (
    <TableRow>
      <TableCell className="px-2 py-1 text-xs">{label}</TableCell>
      <TableCell className={`text-right px-2 py-1 text-xs ${colorClass}`}>{count}</TableCell>
      <TableCell className="text-right px-2 py-1 text-xs">{pct}%</TableCell>
    </TableRow>
  );
}
