'use client';

import { motion } from 'framer-motion';
import { Home, Wallet, HeadsetIcon, UserRound } from 'lucide-react';
import { useAppStore, type Screen } from '@/store/app';

interface BottomNavProps {
  activeTab?: 'home' | 'wallet' | 'support' | 'profile';
}

const tabs: {
  key: 'home' | 'wallet' | 'support' | 'profile';
  label: string;
  icon: React.ReactNode;
  screen: Screen;
}[] = [
  { key: 'home', label: 'Home', icon: <Home className="h-5 w-5" />, screen: 'pre_dashboard' },
  { key: 'wallet', label: 'Wallet', icon: <Wallet className="h-5 w-5" />, screen: 'wallet' },
  {
    key: 'support',
    label: 'Support',
    icon: <HeadsetIcon className="h-5 w-5" />,
    screen: 'support',
  },
  { key: 'profile', label: 'Profile', icon: <UserRound className="h-5 w-5" />, screen: 'profile' },
];

export default function BottomNav({ activeTab = 'home' }: BottomNavProps) {
  const setScreen = useAppStore((s) => s.setScreen);
  const unreadCount = useAppStore((s) => s.rider?.unreadNotifications || 0);

  return (
    <motion.nav
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.3 }}
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 safe-bottom"
    >
      <div className="border-t border-vf-outline-variant bg-vf-surface-container/95 backdrop-blur-md">
        <div className="flex items-center justify-around h-[80px] px-2">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            const hasNotification =
              (tab.key === 'home' || tab.key === 'support') && unreadCount > 0;

            return (
              <button
                key={tab.key}
                onClick={() => setScreen(tab.screen)}
                className="group relative flex flex-1 flex-col items-center justify-center gap-1 transition-all"
              >
                <div className="relative flex h-8 w-16 items-center justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-primary/10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative transition-colors duration-200 ${
                      isActive ? 'text-primary' : 'text-vf-on-surface-variant'
                    }`}
                  >
                    {tab.icon}
                    {hasNotification && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 border border-white" />
                    )}
                  </span>
                </div>
                <span
                  className={`text-[0.75rem] font-bold tracking-tight transition-colors duration-200 ${
                    isActive ? 'text-vf-on-surface' : 'text-vf-on-surface-variant'
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
