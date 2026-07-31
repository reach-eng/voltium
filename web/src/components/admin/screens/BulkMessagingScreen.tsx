'use client';

import { AnnouncementsPagination } from './bulk-messaging/AnnouncementsPagination';
import { AnnouncementsTable } from './bulk-messaging/AnnouncementsTable';
import { AnnouncementDetailDialog } from './bulk-messaging/AnnouncementDetailDialog';
import { BulkMessagingFiltersBar } from './bulk-messaging/BulkMessagingFiltersBar';
import { BulkMessagingHeader } from './bulk-messaging/BulkMessagingHeader';
import { CreateAnnouncementDialog } from './bulk-messaging/CreateAnnouncementDialog';
import { useBulkMessaging } from './bulk-messaging/useBulkMessaging';
import type { AnnouncementFormState } from './bulk-messaging/types';

/**
 * R3.7x shell — composes the Bulk Messaging screen from the feature
 * subdirectory. Data + side effects live in `useBulkMessaging`;
 * sections are rendered by their own components.
 */
export default function BulkMessagingScreen() {
  const m = useBulkMessaging();

  const updateForm = (updater: (prev: AnnouncementFormState) => AnnouncementFormState) => {
    m.setForm((prev) => updater(prev));
  };

  return (
    <div className="space-y-6">
      <BulkMessagingHeader onCreate={() => m.setCreateOpen(true)} />

      <BulkMessagingFiltersBar
        search={m.search}
        onSearchChange={m.setSearch}
        statusFilter={m.statusFilter}
        onStatusChange={m.setStatusFilter}
      />

      <AnnouncementsTable
        announcements={m.announcements}
        loading={m.loading}
        onSelect={m.openDetail}
      />

      <AnnouncementsPagination
        page={m.page}
        totalPages={m.totalPages}
        total={m.total}
        onPageChange={m.setPage}
      />

      <CreateAnnouncementDialog
        open={m.createOpen}
        onOpenChange={m.setCreateOpen}
        form={m.form}
        onFormChange={updateForm}
        hubs={m.hubs}
        sending={m.sending}
        recipientCount={m.recipientCount}
        onSubmit={m.handleCreate}
        onToggleTargetId={m.toggleTargetId}
        onPlanNamesChange={(csv) =>
          m.setForm((prev) => ({
            ...prev,
            targetIds: csv
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }))
        }
      />

      <AnnouncementDetailDialog
        open={m.detailOpen}
        onOpenChange={m.setDetailOpen}
        announcement={m.selectedAnnouncement}
      />
    </div>
  );
}
