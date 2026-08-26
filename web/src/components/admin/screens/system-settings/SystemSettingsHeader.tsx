'use client';

import { Crown } from 'lucide-react';

interface SystemSettingsHeaderProps {
  isSuperAdmin: boolean;
}

/**
 * R3.7k split — System settings tab header.
 *
 * H2 + subtitle on the left, amber "Super Admin" pill on the right
 * (only shown when the current admin has that role). The subtitle
 * warns that some settings require a server restart to take effect.
 */
export function SystemSettingsHeader({ isSuperAdmin }: SystemSettingsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-foreground">System Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage application configuration. Some settings require a server restart to take effect.
        </p>
      </div>
      {isSuperAdmin && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Crown className="w-3 h-3" /> Super Admin
        </span>
      )}
    </div>
  );
}
