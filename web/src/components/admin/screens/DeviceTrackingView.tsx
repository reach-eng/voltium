'use client';

import { useEffect, useState } from 'react';
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
  // P2-14: the local selector initialized from the prop only on mount — if the
  // parent navigated from rider A to rider B, the state stayed stale. Sync it
  // whenever the prop changes (inline mode ignores the state entirely).
  useEffect(() => {
    setSelectedRiderId(riderIdProp);
  }, [riderIdProp]);
  const riderId = riderIdProp ?? selectedRiderId;
  const isStandalone = !riderIdProp;

  const t = useDeviceTracking(riderId);

  // P1-16: the old `t.session &&` short-circuit skipped the permission check
  // while /me was still pending (session null) — a user with a failed session
  // fetch saw the full screen. Wait for the session fetch to SETTLE, then run
  // the check unconditionally (a null session = cannot verify = denied).
  // P2-16: the underlying device-data route enforces the same permission
  // server-side, so this is UX parity, not the security boundary.
  if (t.loading || !t.sessionLoaded) return <DeviceTrackingLoadingState />;

  if (!t.session || !hasPermission(t.session, 'device_tracking_view')) {
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
            // P1-17: the old handler also called t.fetchData(), which used the
            // STALE riderId from the hook closure. Setting the local state to
            // undefined makes the hook's riderId effect reset data + loading
            // on the next render — no explicit fetch needed.
            setSelectedRiderId(undefined);
          }}
        />

        {t.error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            {t.error}
          </div>
        )}

        <DeviceDataSubTabs
          active={t.activeSubTab}
          onChange={t.setActiveSubTab}
          syncing={t.isActionPending && t.confirmDialog.action === 'SYNC_DEVICE_DATA'}
          onSync={() => {
            void t.handleSecurityAction('SYNC_DEVICE_DATA', {});
          }}
          session={t.session}
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
        onConfirm={(action, extra, options) => {
          // P0-2 + P1-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): the
          // dialog supplies a fresh idempotency key (via the
          // requestSecurityAction wrapper) and a free-text reason.
          // Use the wrapper so the key is generated here and replayed
          // by the server's 5-minute cache.
          void t.requestSecurityAction({
            action: action as Parameters<typeof t.requestSecurityAction>[0]['action'],
            reason: options.reason,
            extra,
          });
        }}
      />

      <UnlockCodeDialog
        code={t.generatedUnlockCode}
        onClose={() => t.setGeneratedUnlockCode(null)}
      />
    </>
  );
}
