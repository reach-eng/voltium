/**
 * R3 split (AdminUserManagement) — admin types.
 *
 * Admin + AdminForm were inlined inside AdminUserManagement.tsx.
 * Extracted so the data hook, the form dialog, and the table
 * can all share the same view of what an admin row looks like.
 */

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminForm {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
}

export const EMPTY_ADMIN_FORM: AdminForm = {
  name: '',
  email: '',
  password: '',
  role: 'OPERATIONS_ADMIN',
  permissions: [],
};

export const ADMIN_PAGE_SIZE = 20;

/** Map of role → Tailwind badge class. */
export const ADMIN_ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'border-red-500/20 text-red-600 bg-red-500/5 dark:text-red-400',
  ADMIN: 'border-primary/20 text-primary bg-primary/5',
  MANAGER: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  FLEET_MANAGER: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  TEAM_LEADER: 'border-cyan-500/20 text-cyan-600 bg-cyan-500/5 dark:text-cyan-400',
};

export const ADMIN_ROLE_FALLBACK = 'border-slate-500/20 text-slate-600 bg-slate-500/5';

/** Role options exposed in the role select. */
export const ADMIN_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'OPERATIONS_ADMIN', label: 'Operations Admin' },
  { value: 'KYC_REVIEWER', label: 'KYC Reviewer' },
  { value: 'FINANCE_ADMIN', label: 'Finance Admin' },
  { value: 'SUPPORT_AGENT', label: 'Support Agent' },
  { value: 'HUB_MANAGER', label: 'Hub Manager' },
  { value: 'FLEET_MANAGER', label: 'Fleet Manager' },
  { value: 'TEAM_LEADER', label: 'Team Leader' },
  { value: 'READ_ONLY', label: 'Read Only' },
];

/** Permission descriptor categories grouped in the form. */
export const PERMISSION_CATEGORIES = ['Riders', 'Vehicles', 'Finance', 'Support', 'Marketing', 'System'];
