'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  getChannelIcon,
  getStatusBadgeClass,
  type Announcement,
} from './types';

interface AnnouncementsTableProps {
  announcements: Announcement[];
  loading: boolean;
  onSelect: (a: Announcement) => void;
}

/**
 * R3.7x split — paginated announcements list.
 *
 * Renders skeleton while loading, an empty-state row when there are no
 * results, and a clickable table where each row opens the detail dialog.
 */
export function AnnouncementsTable({
  announcements,
  loading,
  onSelect,
}: AnnouncementsTableProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="px-6">Title</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-6 text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  No announcements found
                </TableCell>
              </TableRow>
            ) : (
              announcements.map((a) => {
                const ChannelIcon = getChannelIcon(a.channel);
                return (
                  <TableRow
                    key={a.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => onSelect(a)}
                  >
                    <TableCell className="font-medium px-6 max-w-[250px] truncate">
                      {a.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <ChannelIcon className="w-3.5 h-3.5" />
                        <span className="text-xs">{a.channel.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.targetAudience.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{a.totalRecipients}</TableCell>
                    <TableCell className="text-sm text-emerald-600">
                      {a.deliveredCount}
                    </TableCell>
                    <TableCell className="text-sm text-blue-600">{a.readCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-md text-[10px] font-bold uppercase ${getStatusBadgeClass(a.status)}`}
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 text-xs text-muted-foreground whitespace-nowrap">
                      {formatAnnouncementDate(a.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
