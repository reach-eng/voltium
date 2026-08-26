'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ServerHealthHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

/**
 * R3.7i split — Server health tab header.
 *
 * H2 + subtitle on the left, "Refresh Checks" button on the right. The
 * button shows a spinning icon while the fetch is in flight.
 */
export function ServerHealthHeader({ loading, onRefresh }: ServerHealthHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Server Health</h2>
        <p className="text-muted-foreground">
          Monitor local laptop service status, storage path permissions, and resource metrics.
        </p>
      </div>
      <Button
        variant="outline"
        size="default"
        onClick={onRefresh}
        disabled={loading}
        className="gap-2 h-11 px-5 rounded-xl"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Checks
      </Button>
    </div>
  );
}
