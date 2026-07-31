'use client';

import { useMemo } from 'react';
import { useFleetMap } from './fleet-map/useFleetMap';
import { getRiderStatus } from './fleet-map/fleetMapHelpers';
import { LOW_BATTERY_THRESHOLD, type FleetRider } from './fleet-map/types';
import { FleetMapHeader } from './fleet-map/FleetMapHeader';
import { FleetMapSummary } from './fleet-map/FleetMapSummary';
import { FleetFiltersSidebar } from './fleet-map/FleetFiltersSidebar';
import { RiderGrid } from './fleet-map/RiderGrid';
import { RiderDetailDialog } from './fleet-map/RiderDetailDialog';
import { FleetMapSkeleton } from './fleet-map/FleetMapSkeleton';

/**
 * R3 split (FleetMapScreen) — fleet map shell.
 *
 * Pre-split: 20 KB / 515 lines with 9 useState + 1 fetch + 30s
 * polling + Page Visibility + 4 cards + filters + 10-col grid +
 * detail dialog + 5 status helpers all inline.
 * Post-split: thin orchestrator that wires the data hook, derives
 * the 4 status counts, and lays out 6 subcomponents. All state +
 * network logic + 30s polling live in `useFleetMap` (3.9 KB); the
 * 5 status helpers live in `fleetMapHelpers` (2 KB).
 */
export default function FleetMapScreen() {
  const f = useFleetMap();

  // Apply client-side filter on top of the server-filtered list.
  // The hook already re-fetches when filters change, but the
  // server's status + low-battery filters are best-effort and we
  // re-check locally to keep the count cards accurate.
  const filteredRiders = useMemo(
    () =>
      f.riders.filter((r) => {
        const status = getRiderStatus(r);
        if (f.statusFilter !== 'ALL' && status !== f.statusFilter) return false;
        if (f.lowBatteryOnly && (r.batteryLevel ?? 100) >= LOW_BATTERY_THRESHOLD) return false;
        return true;
      }),
    [f.riders, f.statusFilter, f.lowBatteryOnly]
  );

  // Derived status counts for the summary cards
  const activeCount = filteredRiders.filter((r) => getRiderStatus(r) === 'active').length;
  const idleCount = filteredRiders.filter((r) => getRiderStatus(r) === 'idle').length;
  const offlineCount = filteredRiders.filter((r) => getRiderStatus(r) === 'offline').length;
  const lowBatteryCount = filteredRiders.filter(
    (r) => (r.batteryLevel ?? 100) < LOW_BATTERY_THRESHOLD
  ).length;

  const gridRiders: FleetRider[] = filteredRiders.filter(
    (r) => r.lastKnownLat && r.lastKnownLng
  );

  if (f.loading) return <FleetMapSkeleton />;

  return (
    <div className="space-y-6">
      <FleetMapHeader
        lastUpdated={f.lastUpdated}
        refreshing={f.refreshing}
        onRefresh={() => f.fetchData()}
      />

      <FleetMapSummary
        activeCount={activeCount}
        lowBatteryCount={lowBatteryCount}
        idleCount={idleCount}
        offlineCount={offlineCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <FleetFiltersSidebar
          hubs={f.hubs}
          search={f.search}
          setSearch={f.setSearch}
          hubFilter={f.hubFilter}
          setHubFilter={f.setHubFilter}
          statusFilter={f.statusFilter}
          setStatusFilter={f.setStatusFilter}
          lowBatteryOnly={f.lowBatteryOnly}
          setLowBatteryOnly={f.setLowBatteryOnly}
        />
        <RiderGrid riders={gridRiders} onSelect={f.setSelectedRider} />
      </div>

      <RiderDetailDialog
        selectedRider={f.selectedRider}
        onOpenChange={(o) => {
          if (!o) f.setSelectedRider(null);
        }}
      />
    </div>
  );
}
