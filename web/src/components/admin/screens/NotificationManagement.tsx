'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import BulkMessagingScreen from './BulkMessagingScreen';
import { NotificationsTab } from './notifications/NotificationsTab';

/**
 * R3.7f split — Notification management shell.
 *
 * Pre-split: 17.3 KB / 514 lines with Tabs + a 410-line NotificationsTab
 * inline (state + 3 sections + send dialog).
 * Post-split: this file is the Tabs orchestrator only. The Notifications
 * tab content lives under ./notifications/ (7 files).
 */
export default function NotificationManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Messaging</h2>
        <p className="text-muted-foreground text-sm">
          Send individual notifications or targeted broadcast announcements to riders.
        </p>
      </div>
      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="notifications" className="text-xs px-5 font-semibold">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-xs px-5 font-semibold">
            Bulk Messaging
          </TabsTrigger>
        </TabsList>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="bulk">
          <BulkMessagingScreen />
        </TabsContent>
      </Tabs>
    </div>
  );
}
