'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getStatusBadgeClass,
  getSeverityBadgeClass,
  type Incident,
} from './IncidentDetailModal';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

interface Props {
  incidents: Incident[];
  loading: boolean;
  onSelect: (incident: Incident) => void;
}

function formatDate(dateStr: string) {
  return formatDateDDMMYYYY(dateStr);
}

/**
 * R3.7b — the incidents table. Extracted from IncidentManagementScreen.tsx.
 * Renders the loading skeleton OR the table of incidents. Click on a row
 * opens the detail modal (handled by the parent via `onSelect`).
 */
export function IncidentTable({ incidents, loading, onSelect }: Props) {
  return (
    <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="px-6">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rider</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="pr-6 text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    No incidents found
                  </TableCell>
                </TableRow>
              ) : (
                incidents.map((inc) => (
                  <TableRow
                    key={inc.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => onSelect(inc)}
                  >
                    <TableCell className="font-mono text-xs px-6">#{inc.incidentId}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {inc.title}
                    </TableCell>
                    <TableCell className="text-xs">{inc.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-md text-[10px] font-bold uppercase ${getSeverityBadgeClass(inc.severity)}`}
                      >
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-md text-[10px] font-bold uppercase ${getStatusBadgeClass(inc.status)}`}
                      >
                        {inc.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{inc.riderName || '—'}</TableCell>
                    <TableCell className="text-sm">{inc.vehicleNumber || '—'}</TableCell>
                    <TableCell className="text-right pr-6 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(inc.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
