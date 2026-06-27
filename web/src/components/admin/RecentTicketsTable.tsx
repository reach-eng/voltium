'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare } from 'lucide-react';
import { useAdminStore } from '@/store/admin';

interface RecentTicket {
  id: string;
  ticketId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  rider?: { fullName: string | null; name: string | null; riderId: string };
}

interface RecentTicketsTableProps {
  tickets: RecentTicket[];
}

export default function RecentTicketsTable({ tickets }: RecentTicketsTableProps) {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);

  return (
    <Card
      className="rounded-2xl border-border/50 shadow-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-all"
      onClick={() => setActiveSection('tickets')}
    >
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Latest Tickets
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="px-6">Ticket ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="pr-6 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  All clear! No open support tickets.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow key={ticket.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-xs px-6 opacity-60">
                    #{ticket.ticketId}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate group">
                    <span className="text-sm font-medium">{ticket.subject}</span>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {ticket.category}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div
                      className={`w-2 h-2 rounded-full ${ticket.priority === 'CRITICAL' ? 'bg-rose-500 ring-4 ring-rose-500/20' : ticket.priority === 'HIGH' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold rounded-sm ${
                        ticket.status === 'OPEN'
                          ? 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400'
                          : ticket.status === 'IN_PROGRESS'
                            ? 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400'
                            : ticket.status === 'RESOLVED'
                              ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                              : 'border-border text-muted-foreground bg-muted/30'
                      }`}
                    >
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
