'use client';

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
 */
export function BusinessSettingsTab() {
  const { settings, loading, saving, isDirty, updateSetting, updateBool, saveSettings } =
    useSettings();

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading settings...</div>;
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
