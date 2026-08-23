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
  // P0-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): when the admin uses
  // the SMS path, the server returns 200 with `smsSent: true` and
  // never returns the code. The hook tracks this so the screen can
  // show a confirmation toast instead of the deprecated unlock-code
  // dialog.
  const [smsCodeSent, setSmsCodeSent] = useState(false);
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

  // P1-3 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): re-fetch the session
  // every 60s so a demoted admin can't keep triggering actions on a
  // mounted device-tracking screen. The server's permission check is
  // the final guard (the API rejects with 403 even if the cached
  // session still has the old role) — this interval is just to make
  // the client UI reflect the demotion promptly.
  useEffect(() => {
    if (!riderId) return;
    const interval = setInterval(() => {
      void fetchSession();
    }, 60_000);
    return () => clearInterval(interval);
  }, [riderId, fetchSession]);

  useEffect(() => {
    if (riderId) {
      void fetchData();
    } else {
      setLoading(false);
      setData(null);
    }
  }, [riderId, fetchData]);

  const handleSecurityAction = useCallback(
    async (
      action: SecurityAction | '',
      extra: Record<string, unknown> = {},
      options: { idempotencyKey?: string; reason?: string } = {}
    ) => {
      if (!riderId || !action) return;
      setIsActionPending(true);
      try {
        const res = await fetch('/api/admin/riders/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            riderId,
            ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
            ...(options.reason ? { reason: options.reason } : {}),
            ...extra,
          }),
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
          // P0-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): the
          // ADMIN_LOCK response still returns the unlock code for the
          // rider app's lock screen to consume, but we mark it as
          // deprecated. The new SEND_UNLOCK_CODE_SMS path sends the
          // code via SMS and does NOT return it. The UI surfaces this
          // distinction to the admin.
          if (action === 'ADMIN_LOCK' && json.data?.unlockCode) {
            setGeneratedUnlockCode(json.data.unlockCode);
          } else if (action === 'SEND_UNLOCK_CODE_SMS' && json.data?.smsSent) {
            setSmsCodeSent(true);
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

  // P0-2: every trigger generates a fresh idempotency key. The key
  // lives for 5 minutes on the server — long enough to absorb a
  // double-click on the confirm button, short enough to keep the
  // in-memory store small.
  const requestSecurityAction = useCallback(
    (options: {
      action: SecurityAction;
      reason?: string;
      extra?: Record<string, unknown>;
    }) => {
      const idempotencyKey = crypto.randomUUID();
      handleSecurityAction(
        options.action,
        options.extra ?? {},
        { idempotencyKey, reason: options.reason }
      );
    },
    [handleSecurityAction]
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
    smsCodeSent,
    setSmsCodeSent,
    confirmDialog,
    closeConfirmDialog,
    triggerSecurityAction,
    requestSecurityAction,
    handleSecurityAction,
    // revalidation
    fetchData,
  };
}

export type DeviceTrackingHook = ReturnType<typeof useDeviceTracking>;
