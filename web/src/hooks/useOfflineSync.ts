'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cacheRiderState,
  loadCachedRiderState,
  getPendingCount,
  enqueueAction,
  processQueue,
  onConnectivityChange,
  isOnline,
  clearRiderCache,
  clearQueue,
  type QueuedAction,
} from '@/lib/offline-store';
import { useAppStore, type RiderData } from '@/store/app';

// Module-level flag removed — StrictMode remounts would skip cache load.
// Each hook instance now tracks its own attempt via useRef.

interface UseOfflineSyncOptions {
  /** Auto-sync when coming back online. Default: true */
  autoSync?: boolean;
  /** How often to cache rider state (ms). Default: 30000 */
  cacheInterval?: number;
}

interface UseOfflineSyncReturn {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether the sync engine is actively processing */
  isSyncing: boolean;
  /** Number of pending actions in the queue */
  pendingCount: number;
  /** Last sync error message, if any */
  lastError: string | null;
  /** Manually trigger a sync */
  sync: () => Promise<void>;
  /** Add an action to the offline queue */
  queueAction: (
    actionType: QueuedAction['actionType'],
    payload: Record<string, unknown>,
    endpoint: string,
    method?: QueuedAction['method']
  ) => QueuedAction;
  /** Clear all cached data and queue */
  logout: () => void;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
  const { autoSync = true, cacheInterval = 30000 } = options;
  const { rider, setRider } = useAppStore();

  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(getPendingCount());
  const [lastError, setLastError] = useState<string | null>(null);
  const cacheTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cache rider state periodically
  useEffect(() => {
    if (!rider.riderId) return;

    const doCache = () => {
      cacheRiderState({
        riderId: rider.riderId ?? '',
        walletBalance: rider.walletBalance ?? 0,
        currentPlan: rider.currentPlan ?? '',
        assignedVehicle: rider.assignedVehicle ?? '',
        lifecycleStatus: rider.lifecycleStatus ?? 'NEW',
        kycStatus: rider.kycStatus ?? '',
        cachedAt: Date.now(),
      });
    };

    doCache(); // Cache immediately
    cacheTimerRef.current = setInterval(doCache, cacheInterval);

    return () => {
      if (cacheTimerRef.current) clearInterval(cacheTimerRef.current);
    };
  }, [rider, cacheInterval]);

  // Listen to connectivity changes
  useEffect(() => {
    const unsubscribe = onConnectivityChange((newOnline) => {
      setOnline(newOnline);
      if (newOnline) {
        setPending(getPendingCount());
        if (autoSync) {
          sync();
        }
      }
    });

    return unsubscribe;
  }, [autoSync]);

  const sync = useCallback(async () => {
    if (syncing || !online) return;

    setSyncing(true);
    setLastError(null);

    try {
      const result = await processQueue();
      setPending(getPendingCount());

      if (result.failed > 0 && result.errors.length > 0) {
        setLastError(result.errors[0].error);
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [syncing, online]);

  const queueAction = useCallback(
    (
      actionType: QueuedAction['actionType'],
      payload: Record<string, unknown>,
      endpoint: string,
      method: QueuedAction['method'] = 'POST'
    ): QueuedAction => {
      const action = enqueueAction(actionType, payload, endpoint, method);
      setPending(getPendingCount());
      return action;
    },
    []
  );

  const logout = useCallback(() => {
    clearRiderCache();
    clearQueue();
    setPending(0);
  }, []);

  return {
    isOnline: online,
    isSyncing: syncing,
    pendingCount: pending,
    lastError,
    sync,
    queueAction,
    logout,
  };
}

// ─── Hook: Load cached rider state on mount ─────────────────────────────────

export function useCachedRiderLoad(): {
  loaded: boolean;
  fromCache: boolean;
} {
  const { rider, setRider } = useAppStore();
  const cacheLoadedRef = useRef(false);

  // Effect subscribes to external system (localStorage) and updates Zustand store
  useEffect(() => {
    if (cacheLoadedRef.current) return;
    cacheLoadedRef.current = true;

    // Skip if rider data already exists in store
    if (rider.riderId) return;

    // Load from cache into Zustand store
    const cached = loadCachedRiderState();
    if (cached) {
      setRider({
        riderId: cached.riderId,
        walletBalance: cached.walletBalance,
        currentPlan: cached.currentPlan,
        assignedVehicle: cached.assignedVehicle,
        lifecycleStatus: cached.lifecycleStatus,
        kycStatus: cached.kycStatus,
      } as Partial<RiderData>);
    }
  }, [rider.riderId, setRider]);

  // Derive from store — no local state needed
  const hasRiderId = rider.riderId !== undefined && rider.riderId !== '';
  return { loaded: hasRiderId, fromCache: hasRiderId && !!loadCachedRiderState() };
}
