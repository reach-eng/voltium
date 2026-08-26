'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FeatureFlagsScreen from './FeatureFlagsScreen';
import MaintenanceModeScreen from './MaintenanceModeScreen';
import { BusinessSettingsTab } from './settings/BusinessSettingsTab';

/**
 * R3.7d split — Settings management shell.
 *
 * Pre-split: 16.7 KB / 456 lines containing the Tabs + a 370-line
 * BusinessSettingsTab inline (5 cards + state + save).
 * Post-split: this file is the Tabs orchestrator only. The Business
 * Settings tab content lives under ./settings/ (8 files).
 */
export default function SettingsManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
        <p className="text-muted-foreground text-sm">
          Business rules, feature toggles, and maintenance controls.
        </p>
      </div>
      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="business" className="text-xs px-5 font-semibold">
            Business Settings
          </TabsTrigger>
          <TabsTrigger value="flags" className="text-xs px-5 font-semibold">
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs px-5 font-semibold">
            Maintenance Mode
          </TabsTrigger>
        </TabsList>
        <TabsContent value="business">
          <BusinessSettingsTab />
        </TabsContent>
        <TabsContent value="flags">
          <FeatureFlagsScreen />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenanceModeScreen />
        </TabsContent>
      </Tabs>
    </div>
  );
}
