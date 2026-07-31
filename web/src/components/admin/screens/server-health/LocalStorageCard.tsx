'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HardDrive } from 'lucide-react';
import type { ServerHealth } from './types';

interface LocalStorageCardProps {
  health: ServerHealth;
}

/**
 * R3.7i split — Local Storage card.
 *
 * Three rows: Upload directory, Primary backup directory, Secondary
 * USB drive. The first two use the same WRITABLE / ERROR badge, the
 * secondary has a third CONNECTED / DISCONNECTED / N/A state. Each
 * row has a status badge and a small help-text line.
 */
export function LocalStorageCard({ health }: LocalStorageCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-base font-bold">Local Storage Status</CardTitle>
        <HardDrive className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Upload Directory</span>
          <Badge
            className={
              health.localStorageStatus === 'WRITABLE'
                ? 'bg-emerald-600 text-white'
                : 'bg-destructive text-white'
            }
          >
            {health.localStorageStatus}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">{health.localStorage}</div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">Primary Backup Directory</span>
          <Badge
            className={
              health.backupStorageStatus === 'WRITABLE'
                ? 'bg-emerald-600 text-white'
                : 'bg-destructive text-white'
            }
          >
            {health.backupStorageStatus}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">{health.backupStorage}</div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">Secondary USB Drive</span>
          <Badge
            className={
              health.secondaryBackupStatus === 'CONNECTED'
                ? 'bg-emerald-600 text-white'
                : health.secondaryBackupStatus === 'DISCONNECTED'
                  ? 'bg-amber-600 text-white'
                  : 'bg-muted text-muted-foreground'
            }
          >
            {health.secondaryBackupStatus}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">{health.secondaryBackup}</div>
      </CardContent>
    </Card>
  );
}
