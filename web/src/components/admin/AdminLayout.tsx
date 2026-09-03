'use client';
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAdminStore } from '@/store/admin';
import AdminSidebar from './AdminSidebar';
import CommandPalette from './CommandPalette';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Toaster as SonnerToaster } from 'sonner';
import { Menu, Search, ChevronRight, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { hasPermission, type Permission } from '@/lib/permissions';
import { ALL_NAV_ITEMS } from '@/lib/role-config';
import {
  getAdminRefreshToken,
  setAdminRefreshToken,
  clearAdminRefreshToken,
} from '@/lib/admin-refresh-token';
import type { SessionPayload } from '@/lib/session-payload';
import { AdminErrorBoundary } from './error-boundary';
import { AdminLoginForm } from './AdminLoginForm';
import SosAlertBanner from './SosAlertBanner';

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

// Screen import functions for speculative prefetching
export const screenImportMap: Record<string, () => Promise<any>> = {
  overview: () => import('./screens/DashboardOverview'),
  riders: () => import('./screens/RiderManagement'),
  kyc: () => import('./screens/KycManagement'),
  rentals: () => import('./screens/RentalManagement'),
  vehicles: () => import('./screens/VehicleManagement'),
  hubs: () => import('./screens/HubManagement'),
  'wallet-deposits': () => import('./screens/WalletDepositManagement'),
  earnings: () => import('./screens/EarningsManagement'),
  transactions: () => import('./screens/TransactionManagement'),
  tickets: () => import('./screens/TicketManagement'),
  incidents: () => import('./screens/IncidentManagementScreen'),
  'team-leaders': () => import('./screens/TeamLeaderManagement'),
  operations: () => import('./screens/OperationsBoard'),
  'fleet-map': () => import('./screens/FleetMapScreen'),
  shifts: () => import('./screens/ShiftManagement'),
  'rider-scoring': () => import('./screens/RiderScoringScreen'),
  offers: () => import('./screens/OfferManagement'),
  faq: () => import('./screens/FaqManagement'),
  legal: () => import('./screens/LegalManagement'),
  'device-tracking': () => import('./screens/DeviceTrackingView'),
  'workflow-coverage': () => import('./screens/WorkflowCoverageScreen'),
  notifications: () => import('./screens/NotificationManagement'),
  rewards: () => import('./screens/RewardManagement'),
  analytics: () => import('./screens/analytics/AnalyticsDashboard'),
  'admin-users': () => import('./screens/AdminUserManagement'),
  'business-settings': () => import('./screens/SettingsManagement'),
  settings: () => import('./screens/SystemSettingsScreen'),
  'server-health': () => import('./screens/ServerHealthScreen'),
  'data-management': () => import('./screens/data-management'),
  'background-jobs': () => import('./screens/BackgroundJobsScreen'),
  'payment-gateways': () => import('./screens/PaymentGatewayManagement'),
};

const prefetchedSet = new Set<string>();

// P1-13: the admin refresh token lives in lib/admin-refresh-token.ts (shared
// with AdminLoginForm) — never in localStorage/sessionStorage.
// Refresh at ~60% of the 2h access-token TTL (keep in sync with
// ACCESS_TOKEN_TTL in lib/auth.ts).
const ADMIN_REFRESH_INTERVAL_MS = Math.round(2 * 60 * 60 * 0.6) * 1000;

export function prefetchAdminScreen(sectionId: string) {
  if (prefetchedSet.has(sectionId)) return;
  const loader = screenImportMap[sectionId];
  if (loader) {
    prefetchedSet.add(sectionId);
    loader().catch(() => prefetchedSet.delete(sectionId));
  }
}

// Dynamic helper with consistent loader (CSR-only for admin screens)
const loadAdminScreen = (path: string) =>
  dynamic(() => import(`./screens/${path}`), { loading: ScreenLoader, ssr: false });

// Dynamically loaded admin screens (split chunks for better performance)
const sectionMap: Record<string, React.ComponentType> = {
  overview: loadAdminScreen('DashboardOverview'),
  riders: loadAdminScreen('RiderManagement'),
  kyc: loadAdminScreen('KycManagement'),
  rentals: loadAdminScreen('RentalManagement'),
  vehicles: loadAdminScreen('VehicleManagement'),
  hubs: loadAdminScreen('HubManagement'),
  'wallet-deposits': loadAdminScreen('WalletDepositManagement'),
  earnings: loadAdminScreen('EarningsManagement'),
  transactions: loadAdminScreen('TransactionManagement'),
  tickets: loadAdminScreen('TicketManagement'),
  incidents: loadAdminScreen('IncidentManagementScreen'),
  'team-leaders': loadAdminScreen('TeamLeaderManagement'),
  operations: loadAdminScreen('OperationsBoard'),
  'fleet-map': loadAdminScreen('FleetMapScreen'),
  shifts: loadAdminScreen('ShiftManagement'),
  'rider-scoring': loadAdminScreen('RiderScoringScreen'),
  offers: loadAdminScreen('OfferManagement'),
  faq: loadAdminScreen('FaqManagement'),
  legal: loadAdminScreen('LegalManagement'),
  'device-tracking': loadAdminScreen('DeviceTrackingView'),
  'workflow-coverage': loadAdminScreen('WorkflowCoverageScreen'),
  notifications: loadAdminScreen('NotificationManagement'),
  rewards: loadAdminScreen('RewardManagement'),
  analytics: loadAdminScreen('analytics/AnalyticsDashboard'),
  'admin-users': loadAdminScreen('AdminUserManagement'),
  'business-settings': loadAdminScreen('SettingsManagement'),
  settings: loadAdminScreen('SystemSettingsScreen'),
  'server-health': loadAdminScreen('ServerHealthScreen'),
  'data-management': loadAdminScreen('data-management'),
  'background-jobs': loadAdminScreen('BackgroundJobsScreen'),
  'payment-gateways': loadAdminScreen('PaymentGatewayManagement'),
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

// P3-2: single source of truth — labels come from ALL_NAV_ITEMS (role-config.ts)
// instead of a second hardcoded map that could drift.
const sectionLabels: Record<string, string> = Object.fromEntries(
  ALL_NAV_ITEMS.map((item) => [item.id, item.label])
);
// Sections that have screens but deliberately no sidebar entry keep a small
// local override — they are not part of the nav, so they can't live in
// ALL_NAV_ITEMS without appearing in the sidebar.
const EXTRA_SECTION_LABELS: Record<string, string> = {
  'wallet-deposits': 'Wallet Deposits',
  'payment-gateways': 'Payment Gateway',
};
Object.assign(sectionLabels, EXTRA_SECTION_LABELS);

const EXTRA_SECTION_PERMISSIONS: Record<string, Permission> = {
  'wallet-deposits': 'transactions_view',
  'payment-gateways': 'transactions_manage',
};

// P3-3: number-key shortcuts (1-9) follow the canonical nav order from
// ALL_NAV_ITEMS instead of a second hardcoded list.
const numberToSection = ALL_NAV_ITEMS.slice(0, 9).map((item) => item.id);

function AdminSectionRenderer({ section, session }: { section: string; session: any }) {
  const item = ALL_NAV_ITEMS.find((i) => i.id === section);
  const requiredPermission = item?.permission || EXTRA_SECTION_PERMISSIONS[section];
  if (requiredPermission && session) {
    const hasPerm = hasPermission(session, requiredPermission);
    if (!hasPerm) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-muted-foreground p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm max-w-sm">
            You do not have the required permissions ({requiredPermission}) to access the{' '}
            {item?.label || EXTRA_SECTION_LABELS[section] || section} section.
          </p>
        </div>
      );
    }
  }

  const Component = sectionMap[section];
  if (Component) {
    return <Component />;
  }
  return <PlaceholderSection name={sectionLabels[section] || section} />;
}

// P1-5: shown when the auth check fails for infra reasons (5xx / network),
// distinct from the login form so admins know it's not a credential problem.
function AdminAuthErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background p-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-black mb-2 tracking-tight">Server unreachable</h1>
        <p className="text-sm text-muted-foreground mb-6 font-medium leading-relaxed">
          The admin service didn't respond. This is a connectivity problem, not a sign-in
          problem — retry before entering your credentials.
        </p>
        <Button size="lg" className="w-full font-bold" onClick={onRetry}>
          Retry connection
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const activeSection = useAdminStore((s) => s.activeSection);
  const sidebarCollapsed = useAdminStore((s) => s.sidebarCollapsed);
  const breadcrumbs = useAdminStore((s) => s.breadcrumbs);
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const setCommandPaletteOpen = useAdminStore((s) => s.setCommandPaletteOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  // P1-7: typed session — no more `any`. The /me payload is a superset of
  // SessionPayload (admin profile fields), so it's narrowed at the set site.
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  // P1-5: distinguish "logged out" (401/403 → login form) from "server is
  // down" (5xx/network → retry screen) so admins aren't sent to the login
  // form during an outage.
  const [authError, setAuthError] = useState(false);
  const [visitedSections, setVisitedSections] = useState<Set<string>>(new Set([activeSection]));

  useEffect(() => {
    setVisitedSections((prev) => {
      if (prev.has(activeSection)) return prev;
      const next = new Set(prev);
      next.add(activeSection);
      return next;
    });
  }, [activeSection]);

  // P1: sync the in-memory section router with the URL so in-app navigation
  // is deep-linkable/shareable and the back button works. `replaceState`
  // (not Next navigation) preserves the keep-alive `visitedSections` mounts.
  // On mount, honor a valid ?section= (deep link); thereafter, reflect the
  // active section. Invalid values are ignored (fail-closed to current).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('section');
      if (fromUrl && fromUrl in sectionMap && fromUrl !== useAdminStore.getState().activeSection) {
        setActiveSection(fromUrl);
      }
    } catch {
      // non-browser / malformed URL — stay on the default section.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('section') === activeSection) return;
      url.searchParams.set('section', activeSection);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // non-browser — nothing to sync.
    }
  }, [activeSection]);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (!getAdminRefreshToken()) return false;
    try {
      const res = await fetch('/api/admin/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: getAdminRefreshToken() }),
        credentials: 'include',
      });
      if (!res.ok) {
        // Only a 401 means the refresh token itself is dead (revoked,
        // expired, deactivated). Transient 5xx/429s keep the token so the
        // next cycle retries — one blip must not log the admin out later.
        if (res.status === 401) clearAdminRefreshToken();
        return false;
      }
      try {
        const data = await res.json();
        // Rotation: the server invalidated the old refresh token and mints a
        // new one — keep the latest copy.
        if (data?.data?.refreshToken) setAdminRefreshToken(data.data.refreshToken);
      } catch {
        // cookie was rotated via Set-Cookie even if the body was malformed
      }
      return true;
    } catch {
      return false; // network blip — the caller decides whether to retry
    }
  }, []);

  const runAuthCheck = useCallback(async () => {
    let res: Response;
    try {
      res = await fetch('/api/admin/auth/me', { credentials: 'include' });
    } catch {
      setAuthError(true);
      setIsAuthorized(false);
      return;
    }

    // P1-13: if the access token expired, try one silent refresh before
    // giving up and showing the login form.
    if (res.status === 401 && (await refreshTokens())) {
      try {
        res = await fetch('/api/admin/auth/me', { credentials: 'include' });
      } catch {
        setAuthError(true);
        setIsAuthorized(false);
        return;
      }
    }

    if (res.status === 401 || res.status === 403) {
      // Genuinely logged out (or deactivated) — the login form is correct.
      setAuthError(false);
      setIsAuthorized(false);
      return;
    }
    if (!res.ok) {
      // P1-5: server error — never masquerade as "not logged in".
      setAuthError(true);
      setIsAuthorized(false);
      return;
    }
    try {
      const data = await res.json();
      if (data?.success && data?.data?.role) {
        setIsAuthorized(true);
        setSession(data.data as SessionPayload);
        setAuthError(false);
      } else {
        setAuthError(false);
        setIsAuthorized(false);
      }
    } catch {
      setAuthError(true);
      setIsAuthorized(false);
    }
  }, [refreshTokens]);

  useEffect(() => {
    // P1-4: the auth check must not depend on the dashboard endpoint — a
    // slow or down stats API can't force an authenticated admin to the
    // login form. The dashboard prefetch is fire-and-forget.
    fetch('/api/admin/dashboard', { credentials: 'include' }).catch(() => {});
    void runAuthCheck();
  }, [runAuthCheck]);

  // Speculative idle prefetching of primary screens for instant navigation
  useEffect(() => {
    if (isAuthorized !== true) return;
    const idleId =
      typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback(
            () => {
              prefetchAdminScreen('overview');
              prefetchAdminScreen('riders');
              prefetchAdminScreen('kyc');
              prefetchAdminScreen('vehicles');
            },
            { timeout: 2000 }
          )
        : setTimeout(() => {
            prefetchAdminScreen('overview');
            prefetchAdminScreen('riders');
            prefetchAdminScreen('kyc');
            prefetchAdminScreen('vehicles');
          }, 800);

    return () => {
      if (typeof cancelIdleCallback !== 'undefined' && typeof idleId === 'number') {
        cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId as any);
      }
    };
  }, [isAuthorized]);

  // P1-13: background session refresh — keeps long-lived admin sessions
  // alive past the 2h access-token TTL without a full re-login.
  useEffect(() => {
    if (isAuthorized !== true) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await refreshTokens();
        if (cancelled) return;
        // Keep the cycle going as long as we still hold a refresh token;
        // transient failures just skip that cycle.
        if (getAdminRefreshToken()) schedule();
      }, ADMIN_REFRESH_INTERVAL_MS);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthorized, refreshTokens]);

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

  // P1-5: server-down is a retryable error, not a sign-in failure.
  if (isAuthorized === false && authError) {
    return <AdminAuthErrorScreen onRetry={() => void runAuthCheck()} />;
  }

  if (isAuthorized === false) {
    return (
      <AdminLoginForm
        loginLoading={loginLoading}
        setLoginLoading={setLoginLoading}
        onAuthenticated={(data) => {
          setIsAuthorized(true);
          setSession(data);
        }}
      />
    );
  }

  return (
    <AdminErrorBoundary>
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 h-dvh overflow-hidden">
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
      <CommandPalette session={session} />

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden outline-none">
        {/* Top Bar */}
        <header className="h-16 border-b bg-card flex items-center px-6 gap-4 shrink-0 transition-colors duration-200">
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
              <ChevronRight className="w-4 h-4" />
              <span className="truncate">{bc.label}</span>
            </span>
          ))}

          {/* Search trigger + dark mode */}
          <div className="ml-auto flex items-center gap-2">
            {/* Command palette trigger */}
            <Button
              variant="outline"
              size="default"
              className="hidden sm:flex items-center gap-2 h-10 px-4 text-sm text-muted-foreground transition-colors"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <Search className="w-4 h-4" />
              Search...
              <kbd className="ml-2 bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">⌘K</kbd>
            </Button>

            {/* Dark mode toggle */}
            <ThemeToggle />
            
            <Button
              variant="outline"
              size="default"
              className="hidden sm:flex items-center gap-2 h-10 px-4 font-medium transition-colors"
              // P3-4: the rider app is served same-origin at /rider-app — a
              // production deploy that forgets NEXT_PUBLIC_FLUTTER_WEB_URL must
              // not point this button at the developer's localhost.
              onClick={() => {
                const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
                const targetUrl = isLocal ? (process.env.NEXT_PUBLIC_FLUTTER_WEB_URL || '/rider-app') : '/rider-app';
                window.open(targetUrl, '_blank');
              }}
            >
              Rider App
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <ScrollArea className="flex-1 h-full min-h-0" data-admin-scroll="true">
          <div className="p-4 md:p-5 space-y-4">
            <SosAlertBanner />
            {Array.from(visitedSections).map((section) => (
              <div
                key={section}
                className={activeSection === section ? 'block animate-in fade-in slide-in-from-bottom-2 duration-300' : 'hidden'}
              >
                <AdminSectionRenderer section={section} session={session} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </main>
      <SonnerToaster position="bottom-right" richColors closeButton />
      <div id="admin-hydration-marker" style={{ display: 'none' }} />
    </div>
    </AdminErrorBoundary>
  );
}
