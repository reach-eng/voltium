'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MessageSquare } from 'lucide-react';
import { ExportButton } from '@/components/admin/export-button';
import type { Ticket } from './types';

export interface TicketFiltersBarProps {
  search: string;
  setSearch: (s: string) => void;
  priorityFilter: string;
  setPriorityFilter: (p: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  statusCounts: Record<string, number>;
  tickets: Ticket[];
  getAssignedName: (adminId: string | null) => string;
  setCreateModalOpen: (open: boolean) => void;
}

export function TicketFiltersBar({
  search,
  setSearch,
  priorityFilter,
  setPriorityFilter,
  activeTab,
  setActiveTab,
  statusCounts,
  tickets,
  getAssignedName,
  setCreateModalOpen,
}: TicketFiltersBarProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Support Tickets</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage rider support tickets and issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateModalOpen(true)} size="default" className="rounded-xl h-11 px-5">
            <MessageSquare className="mr-1.5 h-5 w-5" /> Create Ticket
          </Button>
          <ExportButton
            data={tickets.map((t) => ({
              ticketId: t.ticketId,
              riderId: t.riderId,
              riderName: t.riderName,
              riderPhone: t.riderPhone,
              category: t.category,
              priority: t.priority,
              subject: t.subject,
              status: t.status,
              assignedTo: getAssignedName(t.assignedTo),
              createdAt: t.createdAt,
            }))}
            filename="tickets"
            columns={[
              { key: 'ticketId', label: 'Ticket ID' },
              { key: 'riderName', label: 'Rider Name' },
              { key: 'riderPhone', label: 'Rider Phone' },
              { key: 'category', label: 'Category' },
              { key: 'priority', label: 'Priority' },
              { key: 'subject', label: 'Subject' },
              { key: 'status', label: 'Status' },
              { key: 'assignedTo', label: 'Assigned To' },
              { key: 'createdAt', label: 'Created At' },
            ]}
          />
        </div>
      </div>

      {/* Search & Priority Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search ticket ID, subject, or rider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-11 px-3 rounded-xl border border-muted-foreground/20 bg-background text-base"
        >
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        {search || priorityFilter !== 'ALL' ? (
          <Button
            variant="ghost"
            size="default"
            className="h-11 text-sm px-4 text-muted-foreground"
            onClick={() => {
              setSearch('');
              setPriorityFilter('ALL');
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <TabsList className="bg-muted/30 p-1 rounded-xl">
        <TabsTrigger value="all" className="rounded-lg text-xs font-bold h-10 px-4">
          All ({statusCounts.all || 0})
        </TabsTrigger>
        <TabsTrigger value="OPEN" className="rounded-lg text-xs font-bold h-10 px-4">
          Open ({statusCounts.OPEN || 0})
        </TabsTrigger>
        <TabsTrigger value="IN_PROGRESS" className="rounded-lg text-xs font-bold h-10 px-4">
          In Progress ({statusCounts.IN_PROGRESS || 0})
        </TabsTrigger>
        <TabsTrigger value="RESOLVED" className="rounded-lg text-xs font-bold h-10 px-4">
          Resolved ({statusCounts.RESOLVED || 0})
        </TabsTrigger>
        <TabsTrigger value="CLOSED" className="rounded-lg text-xs font-bold h-10 px-4">
          Closed ({statusCounts.CLOSED || 0})
        </TabsTrigger>
      </TabsList>
    </div>
  );
}
