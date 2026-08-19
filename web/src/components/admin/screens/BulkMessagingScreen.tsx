'use client';

import { AnnouncementsPagination } from './bulk-messaging/AnnouncementsPagination';
import { AnnouncementsTable } from './bulk-messaging/AnnouncementsTable';
import { AnnouncementDetailDialog } from './bulk-messaging/AnnouncementDetailDialog';
import { BulkMessagingFiltersBar } from './bulk-messaging/BulkMessagingFiltersBar';
import { BulkMessagingHeader } from './bulk-messaging/BulkMessagingHeader';
import { CreateAnnouncementDialog } from './bulk-messaging/CreateAnnouncementDialog';
import { useBulkMessaging } from './bulk-messaging/useBulkMessaging';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
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

      {/* Broadcast to All Confirmation Dialog */}
      <AlertDialog open={m.confirmAllOpen} onOpenChange={m.setConfirmAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Broadcast to All Riders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send this announcement immediately to <strong>ALL {m.recipientCount.toLocaleString()}</strong> riders?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={m.confirmSendAll}
              disabled={m.sending}
              className="bg-primary text-primary-foreground"
            >
              {m.sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Broadcasting...
                </>
              ) : (
                'Send Announcement Now'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
