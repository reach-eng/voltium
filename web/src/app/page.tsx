'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, screenFromHash } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';
import RiderSelector from '@/components/screens/RiderSelector';
import { Button } from '@/components/ui/button';
import { Shield, Smartphone, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const AdminLayout = dynamic(() => import('@/components/admin/AdminLayout'), {
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  ),
});

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// Simple fallback for Rider screens
const ScreenLoading = () => (
  <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
  </div>
);

// Helper function to create dynamic screens with a consistent loading state
const loadScreen = (path: string) =>
  dynamic(() => import(`@/components/screens/${path}`), { loading: ScreenLoading });

// Screen registry — table-driven routing with dynamic imports
const SCREEN_MAP: Record<string, React.ComponentType> = {
  splash: loadScreen('SplashScreen'),
  login: loadScreen('LoginScreen'),
  otp: loadScreen('OtpScreen'),
  legal: loadScreen('LegalConsentScreen'),
  permissions: loadScreen('PermissionScreen'),
  intent: loadScreen('IntentScreen'),
  onboarding: loadScreen('OnboardingScreen'),
  guarantor: loadScreen('GuarantorScreen'),
  pre_dashboard: loadScreen('PreDashboardScreen'),
  active_dashboard: loadScreen('ActiveDashboardScreen'),
  rental_details: loadScreen('RentalDetailsScreen'),
  end_rental: loadScreen('EndRentalScreen'),
  top_up_purpose: loadScreen('TopUpPurposeScreen'),
  top_up_amount: loadScreen('TopUpAmountScreen'),
  top_up_upi: loadScreen('TopUpUpiScreen'),
  top_up_receipt: loadScreen('TopUpReceiptScreen'),
  top_up_success: loadScreen('TopUpReceiptScreen'),
  wallet: loadScreen('WalletScreen'),
  choose_plan: loadScreen('ChoosePlanScreen'),
  plan_success: loadScreen('PlanSuccessScreen'),
  pickup_hub: loadScreen('PickupHubScreen'),
  pickup_vehicle: loadScreen('PickupVehicleScreen'),
  pickup_inspection: loadScreen('PickupInspectionScreen'),
  pickup_confirm: loadScreen('PickupConfirmScreen'),
  pickup_success: loadScreen('PickupSuccessScreen'),
  support: loadScreen('SupportScreen'),
  notifications: loadScreen('NotificationsScreen'),
  profile: loadScreen('ProfileScreen'),
  settings: loadScreen('SettingsScreen'),
  emergency: loadScreen('EmergencyScreen'),
  rewards: loadScreen('RewardsScreen'),
  history: loadScreen('HistoryScreen'),
  legal_page: loadScreen('LegalPageScreen'),
  faq: loadScreen('FaqScreen'),
  tl_details: loadScreen('TlDetailsScreen'),
  vehicle_photos: loadScreen('VehiclePhotosScreen'),
  edit_profile: loadScreen('EditProfileScreen'),
  my_documents: loadScreen('MyDocumentsScreen'),
  referral_details: loadScreen('ReferralScreen'),
};

const SyncBanner = loadScreen('SyncBanner');

function ScreenRouter() {
  const screen = useAppStore((s) => s.screen);

  const ScreenComponent = SCREEN_MAP[screen];

  const PreDashboardScreen = SCREEN_MAP.pre_dashboard;

  return (
    <div className="max-w-md mx-auto min-h-dvh relative bg-background shadow-2xl border-x border-border/50">
      <SyncBanner />
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="min-h-dvh"
        >
          {ScreenComponent ? <ScreenComponent /> : <PreDashboardScreen />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<'admin' | 'rider'>('admin');
  const [isHydrated, setIsHydrated] = useState(false);
  const { riderId } = useRiderSession();

  useEffect(() => {
    // Read URL param after hydration to avoid mismatch
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'admin') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView('admin');
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    function handleViewAsRider(e: Event) {
      const { riderId: _riderId } = (e as CustomEvent).detail || {};
      if (_riderId) {
        setView('rider');
        // Navigate the rider app to pre_dashboard so it loads the rider's dashboard
        useAppStore.getState().setScreen('pre_dashboard');
      }
    }
    window.addEventListener('view-as-rider', handleViewAsRider);
    return () => window.removeEventListener('view-as-rider', handleViewAsRider);
  }, []);

  const initFromHash = useAppStore((s) => s.initFromHash);
  const setScreen = useAppStore((s) => s.setScreen);
  const _hasHydrated = useAppStore((s) => s._hasHydrated);

  useEffect(() => {
    if (_hasHydrated) {
      initFromHash();
    }
  }, [initFromHash, _hasHydrated]);

  useEffect(() => {
    function handlePopState() {
      const screen = screenFromHash(window.location.hash);
      if (screen) {
        setScreen(screen);
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setScreen]);

  // Prevent hydration mismatch: render consistent shell until hydrated
  if (!isHydrated) {
    return (
      <div className="max-w-md mx-auto min-h-dvh relative bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-2 right-2 z-[9999] flex gap-1">
        <Button
          id="admin-panel-btn"
          size="sm"
          variant={view === 'admin' ? 'default' : 'outline'}
          onClick={() => setView('admin')}
          className="text-xs"
        >
          <Shield className="w-3 h-3 mr-1" />
          Admin Panel
        </Button>
        <Button
          id="rider-app-btn"
          size="sm"
          variant={view === 'rider' ? 'default' : 'outline'}
          onClick={() => setView('rider')}
          className="text-xs"
        >
          <Smartphone className="w-3 h-3 mr-1" />
          Rider App
        </Button>
        <div className="bg-background/50 backdrop-blur-sm border border-border/50 rounded-full h-8 flex items-center px-0.5">
          <ThemeToggle />
        </div>
      </div>

      {view === 'admin' ? (
        <ErrorBoundary>
          <AdminLayout />
        </ErrorBoundary>
      ) : (
        <ScreenRouter />
      )}

      {_hasHydrated && view === 'rider' && riderId && <RiderSelector />}
    </>
  );
}
