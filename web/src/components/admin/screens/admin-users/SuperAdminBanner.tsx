'use client';

import { ShieldAlert } from 'lucide-react';

/**
 * R3 split (AdminUserManagement) — super-admin warning banner.
 *
 * Amber/red banner that reminds the admin this section is restricted
 * to SUPER_ADMIN. Renders on every visit, even for the SUPER_ADMIN
 * themselves, as a defence-in-depth reminder before they touch
 * other admins' permissions.
 */
export function SuperAdminBanner() {
  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
      <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-red-600 dark:text-red-400 text-sm">Super Admin Only</p>
        <p className="text-xs text-red-500 dark:text-red-400/80 mt-0.5">
          This section is restricted to Super Admins only. Role changes and admin creation require
          SUPER_ADMIN privileges.
        </p>
      </div>
    </div>
  );
}
