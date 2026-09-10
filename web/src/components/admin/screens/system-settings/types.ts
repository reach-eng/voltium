import type { ReactNode } from 'react';

/**
 * R3.7k split — System settings types.
 *
 * The editable + readOnly maps were inlined inside
 * SystemSettingsScreen.tsx. Extracted so the data hook, the
 * editable category card, and the read-only grid can all share the
 * same view of a setting.
 */

export interface EditableSetting {
  value: string;
  valueType: string;
  category: string;
  isSecret: boolean;
  isEditable: boolean;
  description: string | null;
  // P1-4 (system-settings audit, 2026-09-08): operator hint that an
  // edit needs a process restart to take effect on all workers
  // (PM2 cluster). Rendered as a small badge on the row.
  requiresRestart: boolean;
}

export interface SystemSettingsData {
  editable: Record<string, EditableSetting>;
  readOnly: Record<string, string>;
}

/** Map of category key → human-readable label. */
export const CATEGORY_LABELS: Record<string, string> = {
  APP_URLS: 'Application URLs',
  STORAGE: 'Local Storage',
  BACKUP: 'Backup Configuration',
  SECURITY: 'Security',
  SERVER: 'Server',
};

/** Map of category key → small icon. */
export const CATEGORY_ICONS: Record<string, ReactNode> = {
  APP_URLS: '🌐',
  STORAGE: '💾',
  BACKUP: '⚙️',
  SECURITY: '🔒',
  SERVER: '🖥️',
};
