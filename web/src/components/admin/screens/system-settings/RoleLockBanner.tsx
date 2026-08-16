'use client';

import { AlertTriangle } from 'lucide-react';

interface RoleLockBannerProps {
  adminRole: string;
}

/**
 * R3.7k split — View-only mode banner.
 *
 * Shown only when the admin role is known AND the admin is not a
 * Super Admin. Tells the admin which role they're logged in as and
 * that only Super Admins can modify system settings.
 */
export function RoleLockBanner({ adminRole }: RoleLockBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">View-only mode</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          You are logged in as <strong>{adminRole.replace(/_/g, ' ')}</strong>. Only Super Admins
          can modify system settings.
        </p>
      </div>
    </div>
  );
}
