'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings2 } from 'lucide-react';
import { useSystemSettings } from './system-settings/useSystemSettings';
import { SystemSettingsHeader } from './system-settings/SystemSettingsHeader';
import { RoleLockBanner } from './system-settings/RoleLockBanner';
import { EditableCategoryCard } from './system-settings/EditableCategoryCard';
import { ReadOnlyStatusGrid } from './system-settings/ReadOnlyStatusGrid';
import { SystemSettingsSkeleton } from './system-settings/SystemSettingsSkeleton';

/**
 * R3.7k split — System settings shell.
 *
 * Pre-split: 13.6 KB / 374 lines with 6 useState + role + fetch + save
 * + category grouping + 2 cards + skeleton + error all inline.
 * Post-split: thin orchestrator that wires the data hook and the 5
 * subcomponents. The category grouping is computed via useMemo so
 * the result is stable across re-renders.
 */
export default function SystemSettingsScreen() {
  const s = useSystemSettings();

  // Group editable settings by category. Stable across re-renders.
  const grouped = useMemo(() => {
    if (!s.data) return {};
    const out: Record<string, Array<[string, (typeof s.data)['editable'][string]]>> = {};
    for (const [key, setting] of Object.entries(s.data.editable)) {
      const cat = setting.category || 'SERVER';
      if (!out[cat]) out[cat] = [];
      out[cat].push([key, setting]);
    }
    return out;
  }, [s.data]);

  if (s.loading) return <SystemSettingsSkeleton />;

  if (!s.data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Settings2 className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">Could not load system settings</p>
        <Button
          variant="outline"
          size="default"
          className="mt-4 h-11 px-5 rounded-xl"
          onClick={s.fetchSettings}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SystemSettingsHeader isSuperAdmin={s.isSuperAdmin} />

      {s.adminRole !== null && !s.isSuperAdmin && <RoleLockBanner adminRole={s.adminRole} />}

      {Object.entries(grouped).map(([category, settings]) => (
        <EditableCategoryCard
          key={category}
          category={category}
          settings={settings}
          editValues={s.editValues}
          setEditValues={s.setEditValues}
          showSecrets={s.showSecrets}
          setShowSecrets={s.setShowSecrets}
          saving={s.saving}
          isSuperAdmin={s.isSuperAdmin}
          onSave={s.handleSave}
        />
      ))}

      <div className="h-px bg-border" />

      <ReadOnlyStatusGrid readOnly={s.data.readOnly} />

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="default"
          className="h-11 px-5 rounded-xl"
          onClick={s.fetchSettings}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>
    </div>
  );
}
