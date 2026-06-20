import { hasPermission, type Permission, type SessionPayload } from '@/lib/permissions';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  permission: Permission;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard', permission: 'analytics_view' },
  { id: 'riders', label: 'Riders', icon: 'Users', permission: 'riders_view' },
  { id: 'kyc', label: 'Onboarding / KYC', icon: 'Shield', permission: 'kyc_view' },
  { id: 'rentals', label: 'Rentals', icon: 'CalendarDays', permission: 'riders_view' },
  { id: 'vehicles', label: 'Vehicles', icon: 'Bike', permission: 'vehicles_view' },
  { id: 'hubs', label: 'Hubs', icon: 'MapPin', permission: 'hubs_manage' },
  { id: 'transactions', label: 'Finance', icon: 'ArrowLeftRight', permission: 'transactions_view' },
  { id: 'tickets', label: 'Support', icon: 'MessageSquare', permission: 'tickets_view' },
  { id: 'incidents', label: 'Incidents & Fines', icon: 'AlertOctagon', permission: 'tickets_view' },
  { id: 'team-leaders', label: 'Team Leaders', icon: 'UserCog', permission: 'tl_manage' },
  { id: 'operations', label: 'Operations', icon: 'Activity', permission: 'analytics_view' },

  { id: 'fleet-map', label: 'Fleet Map', icon: 'Map', permission: 'vehicles_view' },
  { id: 'shifts', label: 'Shifts', icon: 'Clock', permission: 'tl_manage' },
  { id: 'rider-scoring', label: 'Rider Scoring', icon: 'Target', permission: 'analytics_view' },
  { id: 'notifications', label: 'Messaging', icon: 'Bell', permission: 'notifications_manage' },
  { id: 'offers', label: 'Offers & Coupons', icon: 'Sparkles', permission: 'offers_manage' },
  { id: 'rewards', label: 'Rewards', icon: 'Award', permission: 'rewards_manage' },

  {
    id: 'analytics',
    label: 'Reports & Analytics',
    icon: 'BarChart3',
    permission: 'analytics_view',
  },
  { id: 'admin-users', label: 'Admin Access', icon: 'Users2', permission: 'admins_manage' },
  { id: 'faq', label: 'FAQ Management', icon: 'HelpCircle', permission: 'faq_manage' },
  { id: 'legal', label: 'Legal Documents', icon: 'FileText', permission: 'legal_manage' },
  {
    id: 'device-tracking',
    label: 'Device Tracking',
    icon: 'Radar',
    permission: 'device_tracking_view',
  },
  {
    id: 'workflow-coverage',
    label: 'Workflow Coverage',
    icon: 'ListChecks',
    permission: 'analytics_view',
  },
  {
    id: 'business-settings',
    label: 'Configuration',
    icon: 'Settings2',
    permission: 'settings_manage',
  },
  { id: 'settings', label: 'System Settings', icon: 'Settings', permission: 'settings_manage' },
  {
    id: 'server-health',
    label: 'Server Health',
    icon: 'HeartHandshake',
    permission: 'settings_manage',
  },
  {
    id: 'data-management',
    label: 'Data Management',
    icon: 'Database',
    permission: 'data_management_view',
  },
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
