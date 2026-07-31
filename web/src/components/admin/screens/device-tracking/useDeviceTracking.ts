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

// We type the session as SessionPayload so it satisfies hasPermission().
// The actual /api/admin/auth/me response is a superset, so the narrow
// interface is fine.
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
      }
    } catch (err) {
      logger.error('Failed to fetch admin session', { error: err });
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!riderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/riders/${riderId}/device-data`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      logger.error('Failed to fetch device data', { error: err });
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
    session,
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
