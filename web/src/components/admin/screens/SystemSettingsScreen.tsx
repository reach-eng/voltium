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

  // P2-4 (system-settings audit, 2026-09-08): the screen used to
  // group every row (editable + frozen) into one list per category.
  // Mixed cards made the dead-knob banner (PR-1) harder to read
  // (the banner appeared at the top of a card that also contained
  // editable rows) and invited edits to corpses. Split the rows:
  //   - `editable` — `isEditable: true` rows (the 5 LIVE infra keys
  //     after PR-1's freeze). Rendered as before, one card per
  //     category, Save button enabled.
  //   - `frozen` — `isEditable: false` rows (the 10 dead knobs,
  //     INTERNAL locks, BUSINESS legacy rows that this surface
  //     doesn't own). Rendered as a separate "Read-only display"
  //     section below, grouped by category, no Save button.
  // Stable across re-renders.
  const { editable, frozen } = useMemo(() => {
    const editable: Record<string, Array<[string, (typeof s.data)['editable'][string]]>> = {};
    const frozen: Record<string, Array<[string, (typeof s.data)['editable'][string]]>> = {};
    if (s.data) {
      for (const [key, setting] of Object.entries(s.data.editable)) {
        const cat = setting.category || 'SERVER';
        const bucket = setting.isEditable ? editable : frozen;
        if (!bucket[cat]) bucket[cat] = [];
        bucket[cat].push([key, setting]);
      }
    }
    return { editable, frozen };
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

      {Object.entries(editable).map(([category, settings]) => (
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

      {Object.keys(frozen).length > 0 && (
        <>
          <div className="h-px bg-border" />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Read-only display — preserved for forensic context
            </h2>
            <p className="text-xs text-muted-foreground">
              The rows below are not editable from this surface. Their values
              are preserved for reference; the description on each row
              points to the active configuration surface.
            </p>
            {Object.entries(frozen).map(([category, settings]) => (
              <EditableCategoryCard
                key={`frozen-${category}`}
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
          </section>
        </>
      )}

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
