'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { SessionPayload } from '@/lib/session-payload';
import { buildSecurityActionCopy } from './securityActionLabels';
import type {
  ConfirmDialogState,
  DeviceData,
  SecurityAction,
  SubTabId,
} from './types';

// The /api/admin/auth/me response carries more fields than SessionPayload
// (phone, permissions, etc.); the narrow interface is the subset we consume.
type AdminSession = SessionPayload;

/**
 * R3.7bb split — Device Tracking data hook.
 *
 * Owns: data + session fetch, active sub-tab, search query, action
 * pending state, generated unlock code, and the security-action
 * dispatcher (which opens a confirm dialog then fires the API).
 */
export function useDeviceTracking(riderId: string | undefined) {
  const [data, setData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  // P1-16: distinct from `session` so the view can wait for the /me fetch to
  // SETTLE (success OR failure) before running the permission check — a
  // pending/null session must not short-circuit it.
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // P1-14: surfaced as an error banner instead of a silent empty state.
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('calls');
  const [searchQuery, setSearchQuery] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [generatedUnlockCode, setGeneratedUnlockCode] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    action: '',
    extraData: {},
  });

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/me');
      if (res.ok) {
        const json = await res.json();
        setSession(json.data);
      } else {
        setError('Session check failed — permission cannot be verified');
      }
    } catch (err) {
      logger.error('Failed to fetch admin session', { error: err });
      setError('Session check failed — permission cannot be verified');
    } finally {
      setSessionLoaded(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!riderId) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/riders/${riderId}/device-data`);
      if (!res.ok) {
        setError(`Failed to load device data (${res.status})`);
        setData(null);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load device data');
        setData(null);
      }
    } catch (err) {
      logger.error('Failed to fetch device data', { error: err });
      setError('Failed to load device data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (riderId) {
      void fetchData();
    } else {
      setLoading(false);
      setData(null);
    }
  }, [riderId, fetchData]);

  const handleSecurityAction = useCallback(
    async (action: SecurityAction | '', extra: Record<string, unknown> = {}) => {
      if (!riderId || !action) return;
      setIsActionPending(true);
      try {
        const res = await fetch('/api/admin/riders/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, riderId, ...extra }),
        });
        // P1-14: a non-JSON error (proxy 502, network reset) previously
        // threw inside res.json() and fell into the catch — now handled
        // explicitly with the HTTP status.
        if (!res.ok) {
          toast.error(`Request failed (${res.status})`);
          return;
        }
        const json = await res.json();
        if (json.success) {
          toast.success(json.message || `${action} triggered successfully`);
          if (action === 'ADMIN_LOCK' && json.data?.unlockCode) {
            setGeneratedUnlockCode(json.data.unlockCode);
          }
          setUnlockPasswordInput('');
          await fetchData();
        } else {
          toast.error(json.error || `Failed to trigger ${action}`);
        }
      } catch (err) {
        logger.error(`Failed to trigger ${action}`, { error: err });
        toast.error(`System error while triggering ${action}`);
      } finally {
        setIsActionPending(false);
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      }
    },
    [riderId, fetchData]
  );

  const triggerSecurityAction = useCallback(
    (action: SecurityAction, extra: Record<string, unknown> = {}) => {
      const { title, message } = buildSecurityActionCopy(action, extra);
      setConfirmDialog({
        open: true,
        title,
        message,
        action,
        extraData: extra,
      });
    },
    []
  );

  const closeConfirmDialog = useCallback((open: boolean) => {
    setConfirmDialog((prev) => ({ ...prev, open }));
  }, []);

  return {
    // data
    data,
    loading,
    error,
    session,
    sessionLoaded,
    // sub-tab + search
    activeSubTab,
    setActiveSubTab,
    searchQuery,
    setSearchQuery,
    // security
    isActionPending,
    unlockPasswordInput,
    setUnlockPasswordInput,
    generatedUnlockCode,
    setGeneratedUnlockCode,
    confirmDialog,
    closeConfirmDialog,
    triggerSecurityAction,
    handleSecurityAction,
    // revalidation
    fetchData,
  };
}

export type DeviceTrackingHook = ReturnType<typeof useDeviceTracking>;
