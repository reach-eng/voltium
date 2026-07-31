'use client';

import { Button } from '@/components/ui/button';
import { Map, RefreshCw } from 'lucide-react';

interface FleetMapHeaderProps {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * R3 split (FleetMapScreen) — header.
 *
 * H2 + Map icon + subtitle (with "Updated HH:MM" suffix when the
 * timestamp is set). Refresh button on the right spins while a
 * non-background fetch is in flight.
 */
export function FleetMapHeader({ lastUpdated, refreshing, onRefresh }: FleetMapHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Map className="w-6 h-6 text-primary" />
          Fleet Map
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time rider locations and status
          {lastUpdated && (
            <>
              {' '}
              — Updated{' '}
              {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </>
          )}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-11 w-11 hover:bg-primary/10"
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
