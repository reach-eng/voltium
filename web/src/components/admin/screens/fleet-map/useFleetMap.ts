'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { logger } from '@/lib/logger';
import { FLEET_POLL_INTERVAL_MS, type FleetRider, type HubOption } from './types';

/**
 * R3 split (FleetMapScreen) — fleet map data hook.
 *
 * Fetches /api/admin/fleet + /api/admin/hubs in parallel, then
 * polls every 30s. The polling loop is paused when the tab is
 * hidden (Page Visibility API) and resumed on focus. The hook
 * also exposes the local filter state (hub / status / search /
 * low-battery) which gets re-applied server-side on each fetch.
 */
export function useFleetMap() {
  const [riders, setRiders] = useState<FleetRider[]>([]);
  const [hubs, setHubs] = useState<HubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedRider, setSelectedRider] = useState<FleetRider | null>(null);
  const [hubFilter, setHubFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [lowBatteryOnly, setLowBatteryOnly] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (hubFilter !== 'ALL') params.set('hubId', hubFilter);
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (lowBatteryOnly) params.set('lowBattery', 'true');

        const [fleetRes, hubsRes] = await Promise.all([
          fetch(`/api/admin/fleet?${params}`),
          fetch('/api/admin/hubs'),
        ]);

        if (fleetRes.ok) {
          const json = await fleetRes.json();
          setRiders(json.data?.riders || []);
        }
        if (hubsRes.ok) {
          const json = await hubsRes.json();
          setHubs(json.data || []);
        }
        setLastUpdated(new Date());
      } catch (error) {
        if (!isBackground) {
          logger.error('Failed to fetch fleet data', { error });
        } else {
          logger.warn('Background fetch for fleet data failed', { error });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hubFilter, statusFilter, debouncedSearch, lowBatteryOnly]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), FLEET_POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Pause polling when the tab is hidden (Page Visibility API)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        fetchData(true);
        intervalRef.current = setInterval(() => fetchData(true), FLEET_POLL_INTERVAL_MS);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  return {
    // data
    riders,
    hubs,
    loading,
    refreshing,
    lastUpdated,
    // selection
    selectedRider,
    setSelectedRider,
    // filters
    hubFilter,
    setHubFilter,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    lowBatteryOnly,
    setLowBatteryOnly,
    // revalidation
    fetchData,
  };
}

export type FleetMapHook = ReturnType<typeof useFleetMap>;
