'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { SystemSettingsData } from './types';

/**
 * R3.7k split — System settings data hook.
 *
 * Owns the editable + readOnly payload, the per-key edit values, the
 * per-key saving state, the secret show/hide toggles, and the
 * admin's role (used to gate edits to super-admin only). Exposes
 * the data + a few thin callbacks so the orchestrator can stay slim.
 */
export function useSystemSettings() {
  const [data, setData] = useState<SystemSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [adminRole, setAdminRole] = useState<string | null>(null);

  // Fetch admin role on mount — used to gate the Save buttons.
  useEffect(() => {
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.role) setAdminRole(d.data.role);
      })
      .catch(() => {});
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system-settings');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          // Initialize edit values
          const values: Record<string, string> = {};
          for (const [key, setting] of Object.entries(json.data.editable)) {
            values[key] = (setting as { value: string }).value;
          }
          setEditValues(values);
        }
      } else {
        toast.error('Failed to load system settings');
      }
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      if (res.ok) {
        toast.success(`${key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} updated`);
      } else if (res.status === 403) {
        toast.error('Super Admin permission required to modify system settings');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update setting');
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const isSuperAdmin = adminRole === 'SUPER_ADMIN';

  return {
    data,
    loading,
    saving,
    editValues,
    setEditValues,
    showSecrets,
    setShowSecrets,
    adminRole,
    isSuperAdmin,
    fetchSettings,
    handleSave,
  };
}

export type SystemSettingsHook = ReturnType<typeof useSystemSettings>;
