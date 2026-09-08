'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw, Settings2 } from 'lucide-react';
import { useSettings } from './useSettings';
import { SaveBar } from './SaveBar';
import { PricingCard } from './PricingCard';
import { AutomationCard } from './AutomationCard';
import { LimitsPoliciesCard } from './LimitsPoliciesCard';
import { NotificationsCard } from './NotificationsCard';
import { SupportContactCard } from './SupportContactCard';

/**
 * R3.7d split — Business Settings tab orchestrator.
 *
 * Pre-split: ~370 lines of state + 5 cards + 1 save bar all inline.
 * Post-split: this thin orchestrator pulls the data hook and lays out
 * the 5 cards in their original order.
 *
 * P1-4 (settings audit, 2026-09-08): a failed GET no longer fails
 * silently — the admin sees an explicit error banner with a Retry
 * button, and Save is blocked while the server state is unknown (the
 * hook also guards `saveSettings` itself, so a stale SaveBar can't
 * bypass this).
 */
export function BusinessSettingsTab() {
  const { settings, loading, saving, loadError, isDirty, updateSetting, updateBool, saveSettings, fetchSettings } =
    useSettings();

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading settings...</div>;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Settings2 className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">Couldn&apos;t load business settings</p>
        <p className="text-xs mt-1">Saving is disabled until the current values load.</p>
        <Button
          variant="outline"
          size="default"
          className="mt-4 h-11 px-5 rounded-xl"
          onClick={fetchSettings}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SaveBar saving={saving} isDirty={isDirty} onSave={saveSettings} />
      <div className="grid gap-6">
        <PricingCard settings={settings} onChange={updateSetting} />
        <AutomationCard
          settings={settings}
          onChange={updateSetting}
          onBoolChange={updateBool}
        />
        <LimitsPoliciesCard settings={settings} onChange={updateSetting} />
        <NotificationsCard settings={settings} onBoolChange={updateBool} />
        <SupportContactCard settings={settings} onChange={updateSetting} />
      </div>
    </div>
  );
}
