'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_SETTINGS, type Settings } from './settingsTypes';

/**
 * Settings data hook.
 *
 * Owns the GET / PUT to /api/admin/settings, holds the live + initial
 * snapshots, exposes typed setters, surface backend messages, and dirty-state memoization.
 */
export function mergeServerSettings(serverData: unknown): Settings {
  if (!serverData || typeof serverData !== 'object') return { ...DEFAULT_SETTINGS };
  const raw = serverData as Record<string, unknown>;
  const payload = (raw.settings && typeof raw.settings === 'object' ? raw.settings : raw) as Record<string, unknown>;
  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (typeof payload[key] === 'string') {
      result[key] = payload[key] as string;
    }
  }
  return result;
}

export function buildDirtyPayload(current: Settings, initial: Settings): Partial<Settings> {
  const dirty: Partial<Settings> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (current[key] !== initial[key]) {
      dirty[key] = current[key];
    }
  }
  return dirty;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [initial, setInitial] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // P1-4 (settings audit, 2026-09-08): a failed GET used to be swallowed
  // with "defaults remain in place" — the admin then edited one field and
  // Save mass-overwrote all 14 production values with defaults. Track the
  // failure and block Save while the server state is unknown.
  const [loadError, setLoadError] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const json = await res.json();
      if (json.success) {
        const merged = mergeServerSettings(json.data);
        setSettings(merged);
        setInitial(merged);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    // P1-4: never mass-overwrite from an unknown server state.
    if (loadError) {
      toast.error(
        'Settings failed to load — cannot save safely. Reload the page and try again.'
      );
      return;
    }
    try {
      setSaving(true);
      // P0-1 (settings audit, 2026-09-08): PUT only the dirty keys. The
      // previous version stringified the entire `settings` object; that
      // (a) 400'd whenever the envelope junk keys had leaked into state
      // (the schema rejects unknown keys) and (b) was a mass-overwrite
      // vector after a failed load. `buildDirtyPayload` is already keyed
      // on the DEFAULT_SETTINGS allowlist, so unknown keys can never
      // re-enter the payload.
      const payload = buildDirtyPayload(settings, initial);
      if (Object.keys(payload).length === 0) {
        // Nothing dirty (can happen if the SaveBar gate races a revert).
        return;
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.message || 'Settings saved successfully');
        setInitial(settings);
      } else {
        toast.error(json?.error?.message || json?.message || 'Failed to save settings');
      }
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateBool = (key: keyof Settings, checked: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: String(checked) }));
  };

  const isDirty = useMemo(() => {
    const keys = Object.keys(settings) as (keyof Settings)[];
    return keys.some((k) => settings[k] !== initial[k]);
  }, [settings, initial]);

  return {
    settings,
    initial,
    loading,
    saving,
    loadError,
    isDirty,
    updateSetting,
    updateBool,
    saveSettings,
    fetchSettings,
  };
}
