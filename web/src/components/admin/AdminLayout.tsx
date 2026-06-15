'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAdminStore } from '@/store/admin';
import AdminSidebar from './AdminSidebar';
import CommandPalette from './CommandPalette';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Toaster as SonnerToaster } from 'sonner';
import { Menu, Search, ChevronRight, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

// Screen placeholder with shimmer animation
function ScreenLoader() {
  return (
    <div className="space-y-6">
      <div className="shimmer h-8 w-64 rounded-lg" />
      <div className="shimmer h-4 w-48 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer h-36 rounded-2xl" />
        ))}
      </div>
      <div className="shimmer h-60 rounded-2xl" />
    </div>
  );
}

// Dynamic helper with consistent loader
const loadAdminScreen = (path: string) =>
  dynamic(() => import(`./screens/${path}`), { loading: ScreenLoader });

// Dynamically loaded admin screens (split chunks for better performance)
const sectionMap: Record<string, React.ComponentType> = {
  overview: loadAdminScreen('DashboardOverview'),
  riders: loadAdminScreen('RiderManagement'),
  kyc: loadAdminScreen('KycManagement'),
  vehicles: loadAdminScreen('VehicleManagement'),
  hubs: loadAdminScreen('HubManagement'),
  rentals: loadAdminScreen('RentalManagement'),
  transactions: loadAdminScreen('TransactionManagement'),
  tickets: loadAdminScreen('TicketManagement'),
  offers: loadAdminScreen('OfferManagement'),
  rewards: loadAdminScreen('RewardManagement'),
  referrals: loadAdminScreen('ReferralManagement'),
  notifications: loadAdminScreen('NotificationManagement'),
  'team-leaders': loadAdminScreen('TeamLeaderManagement'),
  faqs: loadAdminScreen('FaqManagement'),
  legal: loadAdminScreen('LegalManagement'),
  settings: loadAdminScreen('SettingsManagement'),
  'admin-users': loadAdminScreen('AdminUserManagement'),
  'fleet-map': loadAdminScreen('FleetMapScreen'),
  analytics: loadAdminScreen('AnalyticsDashboard'),
  'bulk-messaging': loadAdminScreen('BulkMessagingScreen'),
  'rider-scores': loadAdminScreen('RiderScoringScreen'),
  incidents: loadAdminScreen('IncidentManagementScreen'),
  shifts: loadAdminScreen('ShiftManagement'),
  earnings: loadAdminScreen('EarningsManagement'),
  'data-management': loadAdminScreen('DataManagementScreen'),
};

function PlaceholderSection({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{name}</h2>
      <p className="text-sm">This section is coming soon.</p>
    </div>
  );
}

const sectionLabels: Record<string, string> = {
  overview: 'Overview',
  riders: 'Riders',
  kyc: 'KYC Management',
  vehicles: 'Vehicles',
  hubs: 'Hubs',
  rentals: 'Rentals & Plans',
  transactions: 'Transactions',
  tickets: 'Support Tickets',
  offers: 'Offers & Coupons',
  rewards: 'Rewards',
  referrals: 'Referrals',
  notifications: 'Notifications',
  'team-leaders': 'Team Leaders',
  faqs: 'FAQs',
  legal: 'Legal Documents',
  settings: 'Settings',
  'admin-users': 'Admin Users',
  'fleet-map': 'Fleet Map',
  analytics: 'Analytics',
  'bulk-messaging': 'Bulk Messaging',
  'rider-scores': 'Rider Scores',
  incidents: 'Incidents',
  shifts: 'Shift Management',
  earnings: 'Rider Earnings',
  'data-management': 'Data Management',
};

// Number keys → section shortcuts
const numberToSection = [
  'overview',
  'riders',
  'kyc',
  'vehicles',
  'rentals',
  'transactions',
  'tickets',
  'offers',
  'rewards',
];

function AdminSectionRenderer({ section }: { section: string }) {
  const Component = sectionMap[section];
  if (Component) {
    return <Component />;
  }
  return <PlaceholderSection name={sectionLabels[section] || section} />;
}

export default function AdminLayout() {
  const activeSection = useAdminStore((s) => s.activeSection);
  const sidebarCollapsed = useAdminStore((s) => s.sidebarCollapsed);
  const breadcrumbs = useAdminStore((s) => s.breadcrumbs);
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const setCommandPaletteOpen = useAdminStore((s) => s.setCommandPaletteOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.data?.role) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      })
      .catch(() => setIsAuthorized(false));
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // ⌘K / Ctrl+K — Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Don't intercept number keys when typing in inputs
      if (isInput) return;

      // Escape — close dialogs (handled by radix)
      // Number keys 1-9 — quick section switch
      if (e.key >= '1' && e.key <= '9' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = parseInt(e.key) - 1;
        if (numberToSection[idx]) {
          e.preventDefault();
          setActiveSection(numberToSection[idx]);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveSection, setCommandPaletteOpen]);

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    const handleAutoLogin = async () => {
      setLoginLoading(true);
      try {
        const res = await fetch('/api/admin/auth/auto-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          window.location.reload();
        } else {
          const data = await res.json();
          alert(data.error?.message || 'Login failed');
        }
      } catch (err) {
        alert('Connection error');
      } finally {
        setLoginLoading(false);
      }
    };

    const isDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-8">
          <ShieldAlert className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-black mb-3 tracking-tight">Admin</h1>
        <p className="text-muted-foreground mb-8 max-w-sm font-medium">
          Please log in with your admin credentials to access the management dashboard.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {isDev && (
            <Button
              size="lg"
              className="w-full font-bold shadow-xl shadow-primary/20"
              onClick={handleAutoLogin}
              disabled={loginLoading}
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login as Admin (Dev)'}
            </Button>
          )}

          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => (window.location.href = '/')}
          >
            Return to Rider App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 h-full overflow-hidden">
        <AdminSidebar collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[256px]">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <AdminSidebar collapsed={false} />
        </SheetContent>
      </Sheet>

      {/* Command Palette */}
      <CommandPalette />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Breadcrumb or Section Title */}
          <h1 className="text-lg font-bold text-foreground truncate">
            {sectionLabels[activeSection] || 'Dashboard'}
          </h1>
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ChevronRight className="w-3 h-3" />
              <span className="truncate">{bc.label}</span>
            </span>
          ))}

          {/* Search trigger + dark mode (placed in the middle band, not far right) */}
          <div className="ml-auto mr-[230px] flex items-center gap-1.5">
            {/* Command palette trigger */}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center gap-2 h-8 px-3 text-xs text-muted-foreground"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <Search className="w-3 h-3" />
              Search...
              <kbd className="ml-1 bg-muted px-1 py-0.5 rounded text-[10px] font-mono">⌘K</kbd>
            </Button>

            {/* Dark mode toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <ScrollArea className="flex-1 h-full min-h-0" data-admin-scroll="true">
          <div className="p-6">
            <AdminSectionRenderer section={activeSection} />
          </div>
        </ScrollArea>
      </main>
      <SonnerToaster position="bottom-right" richColors closeButton />
      <div id="admin-hydration-marker" style={{ display: 'none' }} />
    </div>
  );
}
