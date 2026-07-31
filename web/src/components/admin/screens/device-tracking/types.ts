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
  lockPassword: string | null;
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

export type SecurityAction =
  | 'ADMIN_LOCK'
  | 'UNLOCK_DEVICE'
  | 'PERSIST_APP'
  | 'ENFORCE_LOCATION'
  | 'RESTRICT_APPS_CONTROL'
  | 'LOCK_DEVICE'
  | 'FACTORY_RESET'
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
