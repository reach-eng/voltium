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
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [initial, setInitial] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        const merged = { ...DEFAULT_SETTINGS, ...json.data };
        setSettings(merged);
        setInitial(merged);
      }
    } catch {
      /* swallow — defaults remain in place */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
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
    isDirty,
    updateSetting,
    updateBool,
    saveSettings,
  };
}
