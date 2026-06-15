import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminState {
  activeSection: string;
  rootSection: string;
  sidebarCollapsed: boolean;
  darkMode: boolean;
  /** Breadcrumb trail for deep navigation (e.g. Riders → Rider Detail → KYC) */
  breadcrumbs: { label: string; section: string }[];
  /** Whether the ⌘K command palette is open */
  commandPaletteOpen: boolean;

  setActiveSection: (s: string) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  pushBreadcrumb: (label: string, section: string) => void;
  popBreadcrumb: () => void;
  clearBreadcrumbs: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      activeSection: 'overview',
      rootSection: 'overview',
      sidebarCollapsed: false,
      darkMode: false,
      breadcrumbs: [],
      commandPaletteOpen: false,

      setActiveSection: (s) => set({ activeSection: s, rootSection: s, breadcrumbs: [] }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      pushBreadcrumb: (label, section) =>
        set((state) => ({
          breadcrumbs: [...state.breadcrumbs, { label, section }],
          activeSection: section, // Also update activeSection when pushing
        })),
      popBreadcrumb: () =>
        set((state) => {
          const prev = state.breadcrumbs.slice(0, -1);
          const returnSection = prev.length > 0 ? prev[prev.length - 1].section : state.rootSection;
          return { breadcrumbs: prev, activeSection: returnSection };
        }),
      clearBreadcrumbs: () =>
        set((state) => ({ breadcrumbs: [], activeSection: state.rootSection })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'voltium-admin-prefs',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        darkMode: state.darkMode,
      }),
    }
  )
);
