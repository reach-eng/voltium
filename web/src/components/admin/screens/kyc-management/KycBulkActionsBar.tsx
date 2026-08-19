'use client';

import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-react';
import type { KycBulkConfirmAction } from './types';

export interface KycBulkActionsBarProps {
  selectedIds: Set<string>;
  bulkLoading: boolean;
  setBulkConfirmAction: (action: KycBulkConfirmAction) => void;
}

export function KycBulkActionsBar({
  selectedIds,
  bulkLoading,
  setBulkConfirmAction,
}: KycBulkActionsBarProps) {
  if (selectedIds.size === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
      <Button
        size="default"
        onClick={() => setBulkConfirmAction('approve')}
        disabled={bulkLoading}
        className="h-10 text-sm px-4 bg-emerald-600 hover:bg-emerald-700 transition-all duration-200"
        title="Approve all selected"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4 mr-1.5" />
        )}
        Approve All
      </Button>
      <Button
        size="default"
        variant="outline"
        onClick={() => setBulkConfirmAction('info_required')}
        disabled={bulkLoading}
        className="h-10 text-sm px-4 border-orange-500/30 text-orange-600 dark:text-orange-400 transition-all duration-200"
        title="Needs Correction"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <ShieldAlert className="w-4 h-4 mr-1.5" />
        )}
        Needs Correction
      </Button>
      <Button
        size="default"
        variant="destructive"
        onClick={() => setBulkConfirmAction('reject')}
        disabled={bulkLoading}
        className="h-10 text-sm px-4 transition-all duration-200"
        title="Reject all selected"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <ShieldX className="w-4 h-4 mr-1.5" />
        )}
        Reject All
      </Button>
    </div>
  );
}
