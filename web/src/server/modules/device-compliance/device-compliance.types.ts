/**
 * Device Compliance module — Types
 *
 * Manages device policy enforcement: permissions, lock status,
 * uninstall protection, and violation tracking.
 */

export interface DeviceComplianceState {
  riderId: string;
  locationGranted: boolean;
  batteryGranted: boolean;
  contactsGranted: boolean;
  callLogsGranted: boolean;
  micGranted: boolean;
  cameraGranted: boolean;
  phoneGranted: boolean;
  deviceAdminGranted: boolean;
  displayOverlayGranted: boolean;
  isAdminLocked: boolean;
  isUninstallBlocked: boolean;
  isLocationMandatory: boolean;
  isAppsControlRestricted: boolean;
  lastViolationAt: Date | null;
  violationCount: number;
}

export interface DeviceViolation {
  id: string;
  riderId: string;
  permissionId: string;
  status: 'ACTIVE' | 'RESOLVED';
  reportedAt: Date;
  resolvedAt: Date | null;
}

export type DevicePermission =
  | 'location'
  | 'battery'
  | 'contacts'
  | 'call_logs'
  | 'mic'
  | 'camera'
  | 'phone'
  | 'device_admin'
  | 'display_overlay';
