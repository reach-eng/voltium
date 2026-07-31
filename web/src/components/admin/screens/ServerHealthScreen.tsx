'use client';

import { Button } from '@/components/ui/button';
import { useServerHealth } from './server-health/useServerHealth';
import { ServerHealthHeader } from './server-health/ServerHealthHeader';
import { ServerHealthSkeleton } from './server-health/ServerHealthSkeleton';
import { ServicesDaemonsCard } from './server-health/ServicesDaemonsCard';
import { LocalStorageCard } from './server-health/LocalStorageCard';
import { HardwareMetricsCard } from './server-health/HardwareMetricsCard';

/**
 * R3.7i split — Server health shell.
 *
 * Pre-split: 11.9 KB / 287 lines with 4-endpoint fetch + 3 cards + skeleton
 * all inline. Post-split: thin orchestrator that wires the data hook and
 * the 5 subcomponents. Fetch logic + normalisation live in `useServerHealth`
 * (3.7 KB); each card / header / skeleton in its own file under
 * `server-health/`.
 */
export default function ServerHealthScreen() {
  const h = useServerHealth();

  return (
    <div className="space-y-6">
      <ServerHealthHeader loading={h.loading} onRefresh={h.fetchHealth} />

      {h.loading ? (
        <ServerHealthSkeleton />
      ) : !h.health ? (
        <div className="py-8 text-center text-red-500">
          Failed to load health data.{' '}
          <Button variant="link" onClick={h.fetchHealth} className="p-0 h-11 px-2 text-sm">
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ServicesDaemonsCard health={h.health} />
          <LocalStorageCard health={h.health} />
          <HardwareMetricsCard health={h.health} />
        </div>
      )}
    </div>
  );
}
