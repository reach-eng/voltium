import { hasPermission, type Permission, type SessionPayload } from '@/lib/auth';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  permission: Permission;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard', permission: 'analytics_view' },
  { id: 'riders', label: 'Riders', icon: 'Users', permission: 'riders_view' },
  { id: 'kyc', label: 'KYC Management', icon: 'Shield', permission: 'kyc_view' },
  { id: 'guarantors', label: 'Guarantors', icon: 'FileCheck', permission: 'kyc_view' },
  { id: 'rentals', label: 'Rentals', icon: 'CalendarDays', permission: 'riders_view' },
  { id: 'vehicles', label: 'Vehicles', icon: 'Bike', permission: 'vehicles_view' },
  { id: 'hubs', label: 'Hubs', icon: 'MapPin', permission: 'hubs_manage' },
  { id: 'plans', label: 'Plans & Pricing', icon: 'Tag', permission: 'plans_manage' },
  { id: 'wallet-deposits', label: 'Wallet & Deposits', icon: 'Wallet', permission: 'transactions_view' },
  { id: 'transactions', label: 'Payments / Top-ups', icon: 'ArrowLeftRight', permission: 'transactions_view' },
  { id: 'pickup-return', label: 'Pickup & Return', icon: 'ClipboardCheck', permission: 'rentals_pickup_inspection' },
  { id: 'tickets', label: 'Support', icon: 'MessageSquare', permission: 'tickets_view' },
  { id: 'incidents', label: 'Incidents & Fines', icon: 'AlertOctagon', permission: 'tickets_view' },
  { id: 'team-leaders', label: 'Team Leaders', icon: 'UserCog', permission: 'tl_manage' },
  { id: 'operations', label: 'Operations', icon: 'Activity', permission: 'analytics_view' },
  { id: 'notifications', label: 'Notifications', icon: 'Bell', permission: 'notifications_manage' },
  { id: 'rewards', label: 'Rewards & Referrals', icon: 'Award', permission: 'rewards_manage' },
  { id: 'analytics', label: 'Reports & Analytics', icon: 'BarChart3', permission: 'analytics_view' },
  { id: 'admin-users', label: 'Admin Users', icon: 'Users2', permission: 'admins_manage' },
  { id: 'roles-permissions', label: 'Roles & Permissions', icon: 'Key', permission: 'admins_manage' },
  { id: 'audit-logs', label: 'Audit Logs', icon: 'History', permission: 'admins_manage' },
  { id: 'settings', label: 'System Settings', icon: 'Settings', permission: 'settings_manage' },
  { id: 'server-health', label: 'Server Health', icon: 'HeartHandshake', permission: 'settings_manage' },
  { id: 'data-management', label: 'Data Management', icon: 'Database', permission: 'data_management_view' },
  { id: 'maintenance-mode', label: 'Maintenance Mode', icon: 'Octagon', permission: 'settings_manage' },
];

export function getVisibleNavItems(roleOrSession: string | SessionPayload): NavItem[] {
  if (!roleOrSession) return [];
  return ALL_NAV_ITEMS.filter((item) => hasPermission(roleOrSession, item.permission));
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS_ADMIN: 'Operations Admin',
  KYC_REVIEWER: 'KYC Reviewer',
  FINANCE_ADMIN: 'Finance Admin',
  SUPPORT_AGENT: 'Support Agent',
  HUB_MANAGER: 'Hub Manager',
  FLEET_MANAGER: 'Fleet Manager',
  TEAM_LEADER: 'Team Leader',
  READ_ONLY: 'Read Only',
};

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  OPERATIONS_ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  KYC_REVIEWER: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  FINANCE_ADMIN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SUPPORT_AGENT: 'bg-pink-100 text-pink-700 border-pink-200',
  HUB_MANAGER: 'bg-amber-100 text-amber-700 border-amber-200',
  FLEET_MANAGER: 'bg-orange-100 text-orange-700 border-orange-200',
  TEAM_LEADER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  READ_ONLY: 'bg-gray-100 text-gray-700 border-gray-200',
};
