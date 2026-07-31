'use client';

import { useState } from 'react';
import RiderSelector from '@/components/admin/RiderSelector';
import { hasPermission } from '@/lib/permissions';
import { CallRegisterTab } from './device-tracking/CallRegisterTab';
import { ContactsTab } from './device-tracking/ContactsTab';
import { DeviceDataSubTabs } from './device-tracking/DeviceDataSubTabs';
import { DeviceTrackingEmptyState, DeviceTrackingLoadingState, DeviceTrackingPermissionDenied } from './device-tracking/DeviceTrackingStates';
import { DeviceTrackingHeader } from './device-tracking/DeviceTrackingHeader';
import { LocationTab } from './device-tracking/LocationTab';
import { SecurityConfirmDialog } from './device-tracking/SecurityConfirmDialog';
import { SecurityControls } from './device-tracking/SecurityControls';
import { UnlockCodeDialog } from './device-tracking/UnlockCodeDialog';
import { useDeviceTracking } from './device-tracking/useDeviceTracking';

/**
 * R3.7bb shell — composes the Device Tracking screen from the
 * device-tracking/ subdirectory. The hook owns data + actions;
 * the parent supplies a `riderId` prop to render inline (e.g.
 * from a rider detail page) or lets the user pick a rider.
 */
export default function DeviceTrackingView({ riderId: riderIdProp }: { riderId?: string }) {
  const [selectedRiderId, setSelectedRiderId] = useState<string | undefined>(riderIdProp);
  const riderId = riderIdProp ?? selectedRiderId;
  const isStandalone = !riderIdProp;

  const t = useDeviceTracking(riderId);

  if (t.loading) return <DeviceTrackingLoadingState />;

  if (t.session && !hasPermission(t.session, 'device_tracking_view')) {
    return <DeviceTrackingPermissionDenied />;
  }

  if (!riderId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Device Tracking</h2>
          <p className="text-muted-foreground text-sm">
            Select a rider to view device telemetry and security controls.
          </p>
        </div>
        <RiderSelector value="" onChange={(id) => setSelectedRiderId(id)} />
        <DeviceTrackingEmptyState />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <DeviceTrackingHeader
          isStandalone={isStandalone}
          onChangeRider={() => {
            setSelectedRiderId(undefined);
            t.fetchData();
          }}
        />

        <DeviceDataSubTabs
          active={t.activeSubTab}
          onChange={t.setActiveSubTab}
          syncing={t.isActionPending && t.confirmDialog.action === 'SYNC_DEVICE_DATA'}
          onSync={() => {
            void t.handleSecurityAction('SYNC_DEVICE_DATA', {});
          }}
        />

        <div className="min-h-[400px]">
          {t.activeSubTab === 'calls' && <CallRegisterTab calls={t.data?.callLogs} />}
          {t.activeSubTab === 'contacts' && (
            <ContactsTab
              contacts={t.data?.contacts}
              search={t.searchQuery}
              onSearchChange={t.setSearchQuery}
            />
          )}
          {t.activeSubTab === 'location' && <LocationTab locations={t.data?.locations} />}
        </div>

        <div className="pt-6 border-t">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-foreground/80">
              Fleet Security Controls
            </h4>
          </div>
          <SecurityControls
            session={t.session}
            rider={t.data?.rider}
            busy={t.isActionPending}
            unlockPasswordInput={t.unlockPasswordInput}
            onUnlockPasswordChange={t.setUnlockPasswordInput}
            onTrigger={t.triggerSecurityAction}
          />
        </div>
      </div>

      <SecurityConfirmDialog
        state={t.confirmDialog}
        onOpenChange={t.closeConfirmDialog}
        onConfirm={(action, extra) => {
          void t.handleSecurityAction(action, extra);
        }}
      />

      <UnlockCodeDialog
        code={t.generatedUnlockCode}
        onClose={() => t.setGeneratedUnlockCode(null)}
      />
    </>
  );
}
