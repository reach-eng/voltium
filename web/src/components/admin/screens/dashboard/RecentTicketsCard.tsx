'use client';

import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RecentTicket } from './types';

interface RecentTicketsCardProps {
  tickets: RecentTicket[];
  onCardClick: () => void;
  /** P1: role lacks tickets access — say so instead of "All clear!". */
  accessDenied?: boolean;
}

function getPriorityDot(priority: string | null | undefined): string {
  const p = priority?.toUpperCase();
  if (p === 'CRITICAL') return 'bg-rose-500 ring-4 ring-rose-500/20';
  if (p === 'HIGH') return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getStatusBadgeClass(status: string | null | undefined): string {
  const s = status?.toUpperCase();
  if (s === 'OPEN') {
    return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
  }
  if (s === 'IN_PROGRESS') {
    return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
  }
  if (s === 'RESOLVED' || s === 'CLOSED') {
    return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
  }
  return 'border-border text-muted-foreground bg-muted/30';
}

/**
 * R3.7z split — Latest Tickets table card.
 */
export function RecentTicketsCard({ tickets, onCardClick, accessDenied = false }: RecentTicketsCardProps) {
  return (
    // P1 a11y fix: was role-less clickable card wrapping a <table> with
    // fake-interactive rows. Now a plain section with an explicit action.
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden transition-all">
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Latest Tickets
        </CardTitle>
        <CardAction>
          <button
            onClick={onCardClick}
            aria-label="View all tickets"
            className="text-xs font-medium text-primary hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            View all
          </button>
        </CardAction>
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
            {accessDenied ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  Your role has no access to support tickets.
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  All clear! No open support tickets.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="transition-all duration-200 group"
                >
                  <TableCell className="font-mono text-xs px-6 opacity-60">
                    #{ticket.ticketId ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate group" title={ticket.subject ?? ''}>
                    <span className="text-sm font-medium">{ticket.subject || '—'}</span>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {ticket.category || '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {/* P1 a11y: priority was color-only — include text. */}
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${getPriorityDot(ticket.priority)}`} />
                      <span className="text-xs text-muted-foreground">{ticket.priority || '—'}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold rounded-sm ${getStatusBadgeClass(ticket.status)}`}
                    >
                      {/* P1: a null status previously threw and unmounted
                          the whole dashboard. */}
                      {(ticket.status ?? 'UNKNOWN').replaceAll('_', ' ')}
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
