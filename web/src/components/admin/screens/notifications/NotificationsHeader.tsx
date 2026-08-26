'use client';

import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface NotificationsHeaderProps {
  onSendClick: () => void;
}

/**
 * R3.7f split — Notifications tab header.
 *
 * H2 + subtitle on the left, "Send Notification" trigger button on the
 * right. The dialog is opened here but its state lives in the data
 * hook.
 */
export function NotificationsHeader({ onSendClick }: NotificationsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Send and manage rider notifications
        </p>
      </div>
      <Button onClick={onSendClick} size="sm">
        <Send className="h-4 w-4 mr-1" /> Send Notification
      </Button>
    </div>
  );
}
