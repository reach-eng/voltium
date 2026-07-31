'use client';

import { useNotifications } from './useNotifications';
import { NotificationsHeader } from './NotificationsHeader';
import { NotificationFiltersBar } from './NotificationFiltersBar';
import { SendNotificationDialog } from './SendNotificationDialog';
import { NotificationsTable } from './NotificationsTable';

/**
 * R3.7f split — Notifications tab orchestrator.
 *
 * Pre-split: ~410 lines of state + handlers + 3 sections all inline.
 * Post-split: thin orchestrator that pulls the data hook and lays out
 * header → filters → table → send dialog.
 */
export function NotificationsTab() {
  const n = useNotifications();
  const hasActiveFilter = !!n.search || n.typeFilter !== 'ALL' || n.readFilter !== 'ALL';

  return (
    <div className="space-y-6">
      <NotificationsHeader onSendClick={() => n.setDialogOpen(true)} />

      <NotificationFiltersBar
        search={n.search}
        setSearch={n.setSearch}
        typeFilter={n.typeFilter}
        setTypeFilter={(v) => {
          n.setTypeFilter(v);
          n.setPage(1);
        }}
        readFilter={n.readFilter}
        setReadFilter={(v) => {
          n.setReadFilter(v);
          n.setPage(1);
        }}
        onClear={() => {
          n.setSearch('');
          n.setTypeFilter('ALL');
          n.setReadFilter('ALL');
        }}
        hasActiveFilter={hasActiveFilter}
      />

      <NotificationsTable
        notifications={n.notifications}
        loading={n.loading}
        page={n.page}
        totalPages={n.totalPages}
        totalCount={n.totalCount}
        onPageChange={n.setPage}
      />

      <SendNotificationDialog
        open={n.dialogOpen}
        onOpenChange={n.setDialogOpen}
        form={n.form}
        setForm={n.setForm}
        sendToAll={n.sendToAll}
        setSendToAll={n.setSendToAll}
        riderSearch={n.riderSearch}
        setRiderSearch={n.setRiderSearch}
        riders={n.riders}
        isSubmitting={n.isSubmitting}
        onSend={n.sendNotification}
      />
    </div>
  );
}
