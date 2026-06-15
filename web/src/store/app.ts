import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FlatRider } from '@/types/api';
import { toast } from '@/hooks/use-toast';

// All valid screen names for hash-based routing validation
export const VALID_SCREENS: Screen[] = [
  'splash',
  'login',
  'otp',
  'legal',
  'permissions',
  'intent',
  'onboarding',
  'guarantor',
  'pre_dashboard',
  'top_up_purpose',
  'top_up_amount',
  'top_up_upi',
  'top_up_receipt',
  'top_up_success',
  'choose_plan',
  'plan_success',
  'pickup_hub',
  'pickup_vehicle',
  'pickup_inspection',
  'pickup_confirm',
  'pickup_success',
  'active_dashboard',
  'rental_details',
  'end_rental',
  'wallet',
  'history',
  'notifications',
  'support',
  'emergency',
  'profile',
  'settings',
  'legal_page',
  'rewards',
  'tl_details',
  'vehicle_photos',
  'edit_profile',
  'my_documents',
  'referral_details',
  'faq',
];

// Parse screen from URL hash (e.g. "#/wallet" → "wallet")
export function screenFromHash(hash: string): Screen | null {
  const screen = hash.replace(/^#\//, '').replace(/^#/, '');
  if (screen && VALID_SCREENS.includes(screen as Screen)) {
    return screen as Screen;
  }
  return null;
}

export type Screen =
  | 'splash'
  | 'login'
  | 'otp'
  | 'legal'
  | 'permissions'
  | 'intent'
  | 'onboarding'
  | 'guarantor'
  | 'pre_dashboard'
  | 'top_up_purpose'
  | 'top_up_amount'
  | 'top_up_upi'
  | 'top_up_receipt'
  | 'top_up_success'
  | 'choose_plan'
  | 'plan_success'
  | 'pickup_hub'
  | 'pickup_vehicle'
  | 'pickup_inspection'
  | 'pickup_confirm'
  | 'pickup_success'
  | 'active_dashboard'
  | 'rental_details'
  | 'end_rental'
  | 'wallet'
  | 'history'
  | 'notifications'
  | 'support'
  | 'emergency'
  | 'profile'
  | 'settings'
  | 'legal_page'
  | 'rewards'
  | 'tl_details'
  | 'vehicle_photos'
  | 'edit_profile'
  | 'my_documents'
  | 'referral_details'
  | 'faq';

/** @deprecated Use FlatRider from @/types/api instead */
export type RiderData = Partial<FlatRider> & {
  pickupHubId?: string | null;
  pickupVehicleId?: string | null;
};

interface AppState {
  screen: Screen;
  previousScreens: Screen[];
  setScreen: (screen: Screen) => void;
  goBack: () => void;
  initFromHash: () => void;

  rider: RiderData;
  setRider: (data: Partial<RiderData>) => void;

  otpTimer: number;
  setOtpTimer: (t: number) => void;
  otpVerified: boolean;
  setOtpVerified: (v: boolean) => void;
  isLogin: boolean;
  setIsLogin: (v: boolean) => void;

  topUpState: {
    amount: number;
    purpose: string;
  };
  setTopUpState: (amount: number, purpose: string) => void;

  // Toast — delegates to shadcn toast system (single source of truth)
  showToast: (msg: string) => void;

  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

const defaultRider: RiderData = {
  phone: '',
  kycStatus: 'PENDING',
  guarantorStatus: 'PENDING',
  walletBalance: 0,
  securityDeposit: 0,
  depositStatus: 'PENDING',
  paymentStreak: 0,
  planStatus: 'NONE',
  rentalStatus: 'NONE',
  registrationDone: true,
  depositDone: false,
  kycDone: false,
  planDone: false,
  pickupDone: false,
  lifecycleStatus: 'NEW',
  accountStatus: 'PRE_ACTIVE',
  pickupHubId: null,
  pickupVehicleId: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      screen: 'splash',
      previousScreens: [],
      setScreen: (screen) => {
        const prev = get().screen;
        set((state) => ({
          screen,
          previousScreens: [prev, ...state.previousScreens].slice(0, 10),
        }));
        // Sync URL hash for deep-linking support
        if (typeof window !== 'undefined' && screen !== 'splash') {
          const newHash = `#/${screen}`;
          if (window.location.hash !== newHash) {
            window.history.pushState(null, '', newHash);
          }
        }
      },
      goBack: () => {
        const prevScreens = get().previousScreens;
        if (prevScreens.length > 0) {
          const [prev, ...rest] = prevScreens;
          set({ screen: prev, previousScreens: rest });
          if (typeof window !== 'undefined' && prev !== 'splash') {
            window.history.pushState(null, '', `#/${prev}`);
          }
        }
      },
      // Initialize screen from URL hash (called once on mount)
      initFromHash: () => {
        if (typeof window === 'undefined') return;
        const screen = screenFromHash(window.location.hash);
        if (screen) {
          set({ screen });
        }
      },

      rider: defaultRider,
      setRider: (data) => set({ rider: { ...get().rider, ...data } }),

      otpTimer: 0,
      setOtpTimer: (t) => set({ otpTimer: t }),
      otpVerified: false,
      setOtpVerified: (v) => set({ otpVerified: v }),
      isLogin: false,
      setIsLogin: (v) => set({ isLogin: v }),

      topUpState: { amount: 0, purpose: 'TOP_UP' },
      setTopUpState: (amount, purpose) => set({ topUpState: { amount, purpose } }),

      showToast: (msg) => {
        toast({ title: msg });
      },

      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'voltium-rider-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        screen: state.screen,
        rider: state.rider,
        topUpState: state.topUpState,
      }),
    }
  )
);

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).useAppStore = useAppStore;
}
