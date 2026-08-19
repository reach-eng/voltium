import type { SecurityAction } from './types';

/**
 * R3.7bb split — humanize a security action verb into a Title + Message
 * pair. Used by the confirm dialog to show consistent copy.
 */
export function buildSecurityActionCopy(
  action: SecurityAction,
  extra: Record<string, unknown> = {}
): { title: string; message: string } {
  switch (action) {
    case 'ADMIN_LOCK':
      return {
        title: 'Admin Override Lock',
        message:
          'This will generate a 12-digit numeric password and lockdown the device. Continue?',
      };
    case 'UNLOCK_DEVICE':
      return {
        title: 'Unlock Device',
        message:
          'Are you sure you want to remotely unlock this device? This will invalidate the current password.',
      };
    case 'PERSIST_APP': {
      const isAllowingUninstall = !(extra.enabled ?? true);
      return {
        title: isAllowingUninstall ? 'Allow Uninstall' : 'Restrict Uninstall',
        message: isAllowingUninstall
          ? 'Allow the rider to uninstall the app? This will lower fleet security.'
          : 'Restrict the rider from uninstalling the app?',
      };
    }
    case 'ENFORCE_LOCATION': {
      const isAllowingGPS = !(extra.enabled ?? true);
      return {
        title: isAllowingGPS ? 'Allow GPS Toggle' : 'Enforce GPS',
        message: isAllowingGPS
          ? 'Allow the rider to disable GPS services on their device?'
          : 'Force GPS ON and prevent the rider from disabling it?',
      };
    }
    case 'RESTRICT_APPS_CONTROL': {
      const isAllowingControl = !(extra.enabled ?? true);
      return {
        title: isAllowingControl ? 'Allow App Control' : 'Restrict App Control',
        message: isAllowingControl
          ? 'Allow the rider to force-stop apps or clear data?'
          : 'Prevent the rider from force-stopping the app or clearing its data?',
      };
    }
    case 'FACTORY_RESET':
      return {
        title: 'Emergency Wipe',
        message:
          'WARNING: This will permanently wipe all data and factory reset the device. This action cannot be undone. Are you absolutely sure?',
      };
    case 'DISABLE_CAMERA':
      return {
        title: 'Disable Camera',
        message: 'This will prevent the rider from using any camera on the device. Continue?',
      };
    case 'ENABLE_CAMERA':
      return {
        title: 'Enable Camera',
        message: 'Restore camera access for the rider?',
      };
    case 'ENFORCE_PASSCODE':
      return {
        title: 'Enforce Passcode',
        message:
          'This will require the rider to set a complex numeric passcode (min 4 digits). Continue?',
      };
    case 'CHECK_LOCATION_INTEGRITY':
      return {
        title: 'Verify Location Integrity',
        message: 'Trigger a background check for mock locations and GPS spoofing?',
      };
    default:
      return {
        title: action
          .split('_')
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(' '),
        message: `Are you sure you want to perform ${action}?`,
      };
  }
}
