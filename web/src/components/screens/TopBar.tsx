'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell } from 'lucide-react';
import { useAppStore } from '@/store/app';

interface TopBarProps {
  title: string;
  showBack?: boolean;
  showNotifications?: boolean;
  rightAction?: ReactNode;
  transparent?: boolean;
}

export default function TopBar({
  title,
  showBack = true,
  showNotifications = false,
  rightAction,
  transparent = true,
}: TopBarProps) {
  const goBack = useAppStore((s) => s.goBack);

  return (
    <header
      className={`sticky top-0 z-50 w-full pt-12 pb-4 transition-colors ${
        transparent ? 'bg-transparent' : 'bg-[#F1F5F9]'
      }`}
    >
      <div className="flex items-center gap-4 px-5">
        {/* Left section */}
        <div className="flex items-center gap-4 min-w-0">
          {showBack && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-[0px_4px_10px_rgba(0,0,0,0.05)] shrink-0"
            >
              <ArrowLeft className="w-[1.25rem] h-[1.25rem] text-[#1E293B]" strokeWidth={2.5} />
            </motion.button>
          )}

          <h1 className="text-[1.375rem] font-bold text-[#1E293B] truncate tracking-tight">
            {title}
          </h1>
        </div>

        <div className="flex-1" />

        {/* Right section */}
        <div className="flex items-center gap-2 shrink-0">
          {showNotifications && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-[0px_4px_10px_rgba(0,0,0,0.05)] relative"
            >
              <Bell className="w-[1.25rem] h-[1.25rem] text-[#1E293B]" strokeWidth={2} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#1B60DA] border-2 border-white" />
            </motion.button>
          )}

          {rightAction && rightAction}
        </div>
      </div>
    </header>
  );
}
