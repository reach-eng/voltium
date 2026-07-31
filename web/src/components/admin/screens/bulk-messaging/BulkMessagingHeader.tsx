'use client';

import { Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkMessagingHeaderProps {
  onCreate: () => void;
}

/**
 * R3.7x split — page header + primary "Create Announcement" CTA.
 */
export function BulkMessagingHeader({ onCreate }: BulkMessagingHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Send className="w-6 h-6 text-primary" />
          Bulk Messaging
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage announcements and broadcast messages
        </p>
      </div>
      <Button size="sm" className="rounded-full px-4 h-9" onClick={onCreate}>
        <Plus className="w-4 h-4 mr-2" />
        Create Announcement
      </Button>
    </div>
  );
}
