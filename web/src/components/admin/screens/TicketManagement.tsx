'use client';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminErrorBoundary } from '@/components/admin/error-boundary';
import {
  useTickets,
  TicketFiltersBar,
  TicketBulkActionsBar,
  TicketTable,
  TicketDetailDialog,
  TicketDialogs,
} from './ticket-management';

export default function TicketManagement() {
  const t = useTickets();

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <Tabs value={t.activeTab} onValueChange={t.setActiveTab}>
          <TicketFiltersBar
            search={t.search}
            setSearch={t.setSearch}
            priorityFilter={t.priorityFilter}
            setPriorityFilter={t.setPriorityFilter}
            activeTab={t.activeTab}
            setActiveTab={t.setActiveTab}
            statusCounts={t.statusCounts}
            tickets={t.tickets}
            getAssignedName={t.getAssignedName}
            setCreateModalOpen={t.setCreateModalOpen}
          />

          <TicketBulkActionsBar
            selectedIds={t.selectedIds}
            setSelectedIds={t.setSelectedIds}
            bulkLoading={t.bulkLoading}
            tickets={t.tickets}
            getAssignedName={t.getAssignedName}
            setBulkStatusDialog={t.setBulkStatusDialog}
            setBulkAssignDialog={t.setBulkAssignDialog}
            setBulkPriorityDialog={t.setBulkPriorityDialog}
            handleBulkAction={t.handleBulkAction}
            lastAction={t.lastAction}
            handleUndo={t.handleUndo}
          />

          <TabsContent value={t.activeTab} className="mt-4">
            <TicketTable
              filtered={t.filtered}
              loading={t.loading}
              selectedIds={t.selectedIds}
              setSelectedIds={t.setSelectedIds}
              getAssignedName={t.getAssignedName}
              openDetail={t.openDetail}
              page={t.page}
              setPage={t.setPage}
              totalPages={t.totalPages}
              total={t.total}
            />
          </TabsContent>
        </Tabs>

        <TicketDetailDialog
          selectedTicket={t.selectedTicket}
          detailOpen={t.detailOpen}
          setDetailOpen={t.setDetailOpen}
          ticketMessages={t.ticketMessages}
          messagesLoading={t.messagesLoading}
          replyMessage={t.replyMessage}
          setReplyMessage={t.setReplyMessage}
          replyLoading={t.replyLoading}
          handleSendReply={t.handleSendReply}
          handleStatusChange={t.handleStatusChange}
          handleAssign={t.handleAssign}
          handleAssignToMe={t.handleAssignToMe}
          admins={t.admins}
          getAssignedName={t.getAssignedName}
        />

        <TicketDialogs
          bulkStatusDialog={t.bulkStatusDialog}
          setBulkStatusDialog={t.setBulkStatusDialog}
          bulkStatusValue={t.bulkStatusValue}
          setBulkStatusValue={t.setBulkStatusValue}
          bulkPriorityDialog={t.bulkPriorityDialog}
          setBulkPriorityDialog={t.setBulkPriorityDialog}
          bulkPriorityValue={t.bulkPriorityValue}
          setBulkPriorityValue={t.setBulkPriorityValue}
          bulkAssignDialog={t.bulkAssignDialog}
          setBulkAssignDialog={t.setBulkAssignDialog}
          bulkAssignValue={t.bulkAssignValue}
          setBulkAssignValue={t.setBulkAssignValue}
          selectedIdsCount={t.selectedIds.size}
          handleBulkAction={t.handleBulkAction}
          showUndoToast={t.showUndoToast}
          lastAction={t.lastAction}
          bulkLoading={t.bulkLoading}
          handleUndo={t.handleUndo}
          createModalOpen={t.createModalOpen}
          setCreateModalOpen={t.setCreateModalOpen}
          newTicket={t.newTicket}
          setNewTicket={t.setNewTicket}
          isCreating={t.isCreating}
          riders={t.riders}
          riderSearch={t.riderSearch}
          setRiderSearch={t.setRiderSearch}
          handleCreateTicket={t.handleCreateTicket}
          admins={t.admins}
        />
      </div>
    </AdminErrorBoundary>
  );
}
