'use client';

import { MapPin, Phone, RefreshCw, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/lib/permissions';
import type { SessionPayload } from '@/lib/session-payload';
import type { SubTabId } from './types';

interface SubTab {
  id: SubTabId;
  label: string;
  icon: LucideIcon;
}

// P2-8 (2026-08-05 legal/device audit): the device-data route supports a
// `?type=` filter (CALL_LOGS / CONTACTS / LOCATION / all), but the UI fetches
// everything in one call and slices locally. The three tabs map to the three
// data categories the route returns under `all` — intentional, not a bug.
const SUB_TABS: SubTab[] = [
  { id: 'calls', label: 'Call Register', icon: Phone },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'location', label: 'Live GPS', icon: MapPin },
];

interface DeviceDataSubTabsProps {
  active: SubTabId;
  onChange: (id: SubTabId) => void;
  syncing: boolean;
  onSync: () => void;
  session: SessionPayload | null;
}

/**
 * R3.7bb split — sub-tab row (Call Register / Contacts / Live GPS)
 * + the Sync Data action button.
 *
 * P1-11 (2026-08-05 legal/device audit): Sync Data fires SYNC_DEVICE_DATA,
 * which the server gates behind `device_remote_control` — a FLEET_MANAGER
 * with device_tracking_view but not device_remote_control would otherwise
 * click it and get a confusing 403. The button is hidden without the
 * permission (same gate as SecurityControls).
 */
export function DeviceDataSubTabs({
  active,
  onChange,
  syncing,
  onSync,
  session,
}: DeviceDataSubTabsProps) {
  const canSyncData = hasPermission(session ?? '', 'device_remote_control');

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Device Data Hub
        </h3>
        {canSyncData && (
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs font-bold bg-primary hover:bg-primary/90"
            onClick={onSync}
            disabled={syncing}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
        {SUB_TABS.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => onChange(tab.id)}
            className={`flex-1 h-11 rounded-lg text-xs font-bold transition-all duration-300 ${
              active === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02] hover:bg-primary hover:text-white'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </Button>
        ))}
      </div>
    </>
  );
}
