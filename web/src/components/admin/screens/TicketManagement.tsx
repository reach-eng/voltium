'use client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Undo2, MessageSquare } from 'lucide-react';
import { AdminErrorBoundary } from '../error-boundary';
import { ExportButton } from '../export-button';
import { useTicketManagement } from './ticket-management/useTicketManagement';
import { TicketFilters } from './ticket-management/TicketFilters';
import { TicketPagination } from './ticket-management/TicketPagination';
import { TicketTable } from './ticket-management/TicketTable';
import { BulkActionBar } from './ticket-management/BulkActionBar';
import { TicketDetailDialog } from './ticket-management/TicketDetailDialog';
import {
  BulkStatusDialog,
  BulkPriorityDialog,
  BulkAssignDialog,
} from './ticket-management/BulkActionDialogs';
import { CreateTicketModal } from './ticket-management/CreateTicketModal';

/**
 * R3.7 split (TicketManagement) — ticket management shell.
 *
 * Pre-split: 18.8 KB / 540 lines with 21 useState + 6 fetch handlers
 * + keyboard + 15s polling + 7 dialogs inline. Post-split: thin
 * orchestrator that wires the data hook and the existing 9
 * subcomponents in `ticket-management/`. All state + network logic
 * lives in `useTicketManagement` (14 KB).
 */
export default function TicketManagement() {
  const t = useTicketManagement();
  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Support Tickets</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Manage rider support tickets and issues
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => t.setCreateModalOpen(true)}
              size="default"
              className="rounded-xl h-11 px-5"
            >
              <MessageSquare className="mr-1.5 h-5 w-5" /> Create Ticket
            </Button>
            <ExportButton
              data={t.tickets.map((tk) => ({
                ticketId: tk.ticketId,
                riderId: tk.riderId,
                riderName: tk.riderName,
                riderPhone: tk.riderPhone,
                category: tk.category,
                priority: tk.priority,
                subject: tk.subject,
                status: tk.status,
                assignedTo: t.getAssignedName(tk.assignedTo),
                createdAt: tk.createdAt,
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

        <TicketFilters
          search={t.search}
          onSearchChange={t.setSearch}
          priorityFilter={t.priorityFilter}
          onPriorityChange={t.setPriorityFilter}
        />

        <Tabs value={t.activeTab} onValueChange={t.setActiveTab}>
          <BulkActionBar
            selectedIds={t.selectedIds}
            bulkLoading={t.bulkLoading}
            lastAction={t.lastAction}
            tickets={t.tickets}
            onOpenStatusDialog={() => t.setBulkStatusDialog(true)}
            onOpenAssignDialog={() => t.setBulkAssignDialog(true)}
            onOpenPriorityDialog={() => t.setBulkPriorityDialog(true)}
            onBulkCloseResolved={() => t.handleBulkAction('closeResolved')}
            onUndo={t.handleUndo}
            onClearSelection={() => t.setSelectedIds(new Set())}
            getAssignedName={t.getAssignedName}
          />

          <TabsList className="bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg text-xs font-bold h-10 px-4">
              All ({t.statusCounts.all || 0})
            </TabsTrigger>
            <TabsTrigger value="OPEN" className="rounded-lg text-xs font-bold h-10 px-4">
              Open ({t.statusCounts.OPEN || 0})
            </TabsTrigger>
            <TabsTrigger
              value="IN_PROGRESS"
              className="rounded-lg text-xs font-bold h-10 px-4"
            >
              In Progress ({t.statusCounts.IN_PROGRESS || 0})
            </TabsTrigger>
            <TabsTrigger value="RESOLVED" className="rounded-lg text-xs font-bold h-10 px-4">
              Resolved ({t.statusCounts.RESOLVED || 0})
            </TabsTrigger>
            <TabsTrigger value="CLOSED" className="rounded-lg text-xs font-bold h-10 px-4">
              Closed ({t.statusCounts.CLOSED || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={t.activeTab} className="mt-4">
            <TicketTable
              tickets={t.filtered}
              loading={t.loading}
              selectedIds={t.selectedIds}
              onSelectIdsChange={t.setSelectedIds}
              onOpenDetail={t.openDetail}
              getAssignedName={t.getAssignedName}
            />
          </TabsContent>
        </Tabs>

        <TicketPagination
          page={t.page}
          totalPages={t.totalPages}
          total={t.total}
          onPageChange={t.setPage}
        />

        <TicketDetailDialog
          open={t.detailOpen}
          onOpenChange={t.setDetailOpen}
          ticket={t.selectedTicket}
          messages={t.ticketMessages}
          messagesLoading={t.messagesLoading}
          admins={t.admins}
          onStatusChange={t.handleStatusChange}
          onAssign={t.handleAssign}
          onAssignToMe={t.handleAssignToMe}
          onSendReply={t.handleSendReply}
          replyLoading={t.replyLoading}
          getAssignedName={t.getAssignedName}
        />

        <BulkStatusDialog
          open={t.bulkStatusDialog}
          onOpenChange={t.setBulkStatusDialog}
          count={t.selectedIds.size}
          admins={t.admins}
          value={t.bulkStatusValue}
          onValueChange={t.setBulkStatusValue}
          onApply={(val) => t.handleBulkAction('changeStatus', val)}
        />

        <BulkPriorityDialog
          open={t.bulkPriorityDialog}
          onOpenChange={t.setBulkPriorityDialog}
          count={t.selectedIds.size}
          admins={t.admins}
          value={t.bulkPriorityValue}
          onValueChange={t.setBulkPriorityValue}
          onApply={(val) => t.handleBulkAction('changePriority', val)}
        />

        <BulkAssignDialog
          open={t.bulkAssignDialog}
          onOpenChange={t.setBulkAssignDialog}
          count={t.selectedIds.size}
          admins={t.admins}
          value={t.bulkAssignValue}
          onValueChange={t.setBulkAssignValue}
          onApply={(val) => t.handleBulkAction('assign', val)}
        />

        {t.showUndoToast && t.lastAction && (
          <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <span className="text-sm">{t.lastAction.ids.length} ticket(s) updated</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 hover:bg-background/20 text-background"
              disabled={t.bulkLoading}
              onClick={t.handleUndo}
            >
              <Undo2 className="w-3 h-3 mr-1" /> Undo
            </Button>
          </div>
        )}

        <CreateTicketModal
          open={t.createModalOpen}
          onOpenChange={t.setCreateModalOpen}
          onTicketCreated={t.fetchTickets}
        />
      </div>
    </AdminErrorBoundary>
  );
}
