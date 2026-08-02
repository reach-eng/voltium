'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdminStore } from '@/store/admin';
import { BRAND_SHORT } from '@/lib/branding';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertOctagon,
  ArrowLeftRight,
  Award,
  BarChart3,
  Bell,
  Bike,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Database,
  FileCheck,
  FileText,
  HeartHandshake,
  HelpCircle,
  History,
  Key,
  LayoutDashboard,
  ListChecks,
  Map,
  MapPin,
  MessageSquare,
  Octagon,
  Radar,
  Send,
  Settings,
  Settings2,
  Share2,
  Shield,
  Sparkles,
  Tag,
  Target,
  ToggleLeft,
  UserCog,
  Users,
  Users2,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getVisibleNavItems, ROLE_LABELS, ROLE_COLORS } from '@/lib/role-config';
import { LOGO_PATH } from '@/lib/branding';
import { prefetchAdminScreen } from './AdminLayout';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  AlertOctagon,
  ArrowLeftRight,
  Award,
  BarChart3,
  Bell,
  Bike,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Database,
  FileCheck,
  FileText,
  HeartHandshake,
  HelpCircle,
  History,
  Key,
  LayoutDashboard,
  ListChecks,
  Map,
  MapPin,
  MessageSquare,
  Octagon,
  Radar,
  Send,
  Settings,
  Settings2,
  Share2,
  Shield,
  Sparkles,
  Tag,
  Target,
  ToggleLeft,
  UserCog,
  Users,
  Users2,
  Wallet,
};

interface AdminSidebarProps {
  collapsed: boolean;
}

export default function AdminSidebar({ collapsed }: AdminSidebarProps) {
  const activeSection = useAdminStore((s) => s.activeSection);
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const toggleSidebar = useAdminStore((s) => s.toggleSidebar);

  // Fetch admin session for granular permissions
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) {
          setSession(data.data);
        }
      })
      .catch(() => {
        /* Session check failed */
      });
  }, []);

  const adminRole = session?.role || 'ADMIN';
  const visibleItems = useMemo(
    () => getVisibleNavItems(session || adminRole),
    [session, adminRole]
  );

  return (
    <div
      className={`flex flex-col h-full bg-card border-r transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-[256px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <Image
            src={LOGO_PATH}
            alt="Voltium"
            width={24}
            height={24}
            className="object-contain brightness-0 opacity-80"
          />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg text-foreground whitespace-nowrap">
            {BRAND_SHORT} Admin
          </span>
        )}
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-2 border-b">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_COLORS[adminRole]}`}
          >
            {ROLE_LABELS[adminRole]}
          </span>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3 min-h-0 h-full" data-sidebar-scroll="true">
        <nav className="flex flex-col gap-1 px-3">
          {visibleItems.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = iconMap[item.icon];

            const buttonContent = (
              <Button
                variant="ghost"
                className={`w-full justify-start gap-3 h-11 px-4 font-medium transition-colors duration-200 relative z-10 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                } ${collapsed ? 'px-0 justify-center' : ''}`}
              >
                {Icon && <Icon className="w-5 h-5 shrink-0" />}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Button>
            );

            const button = (
              <motion.div
                key={item.id}
                data-nav-id={item.id}
                onClick={() => setActiveSection(item.id)}
                onMouseEnter={() => prefetchAdminScreen(item.id)}
                className="relative cursor-pointer"
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute inset-0 bg-primary/10 rounded-md"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {buttonContent}
              </motion.div>
            );

            if (collapsed) {
              return (
                <TooltipProvider key={item.id} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return button;
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Collapse toggle */}
      <div className="p-3 shrink-0">
        <Button
          variant="ghost"
          size="default"
          onClick={toggleSidebar}
          className="w-full justify-center text-muted-foreground hover:text-foreground h-11 transition-colors duration-200"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
