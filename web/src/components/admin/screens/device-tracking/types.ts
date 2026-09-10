/**
 * R3.7bb split — Device Tracking types.
 */

export interface Contact {
  name: string;
  phone: string;
  email?: string;
}

export interface CallLog {
  name?: string;
  number: string;
  type: 'INCOMING' | 'OUTGOING' | 'MISSED';
  duration: number;
  timestamp: string;
}

export interface LocationPing {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  timestamp: string;
  isMocked: boolean;
}

export interface DeviceRiderSettings {
  isAdminLocked: boolean;
  isUninstallBlocked: boolean;
  isLocationMandatory: boolean;
  isAppsControlRestricted: boolean;
}

export interface DeviceData {
  contacts: Contact[];
  callLogs: CallLog[];
  locations: LocationPing[];
  rider?: DeviceRiderSettings;
}

// P1-13 (2026-08-05 legal/device audit): LOCK_DEVICE removed — the route
// rejected it unconditionally, so the enum value was a footgun. Keep the
// enum in lockstep with `riderActionSchema` in lib/validators.ts.
//
// P0-1 (device-tracking audit, 2026-09-08): FACTORY_RESET removed for the
// same reason — `sendRemoteWipe` → `sendSecurityCommand('FACTORY_RESET')`
// threw unconditionally (`fcm.ts:158`), so the Emergency Wipe button was
// a destructive-but-noop trap that trained admins to distrust confirms.
// The Flutter `factoryReset` handler (`fcm_service.dart:611`) stays so
// a future Android-Enterprise / Apple-MDM pipeline has a client endpoint.
export type SecurityAction =
  | 'ADMIN_LOCK'
  | 'UNLOCK_DEVICE'
  | 'PERSIST_APP'
  | 'ENFORCE_LOCATION'
  | 'RESTRICT_APPS_CONTROL'
  | 'DISABLE_CAMERA'
  | 'ENABLE_CAMERA'
  | 'ENFORCE_PASSCODE'
  | 'CHECK_LOCATION_INTEGRITY'
  | 'SYNC_DEVICE_DATA';

export type SubTabId = 'calls' | 'contacts' | 'location';

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  action: SecurityAction | '';
  extraData: Record<string, unknown>;
}
