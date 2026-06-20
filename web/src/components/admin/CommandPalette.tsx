'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminStore } from '@/store/admin';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  LayoutDashboard,
  Users,
  Shield,
  Bike,
  CalendarDays,
  ArrowLeftRight,
  MessageSquare,
  Tag,
  Award,
  Share2,
  Bell,
  UserCog,
  HelpCircle,
  FileText,
  Settings,
  ShieldCheck,
  Search,
  Loader2,
  User,
  Landmark,
  Car,
} from 'lucide-react';
import { logger } from '@/lib/logger';

const navItems = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    keywords: ['dashboard', 'home', 'stats'],
  },
  { id: 'riders', label: 'Riders', icon: Users, keywords: ['users', 'customers'] },
  { id: 'kyc', label: 'KYC', icon: Shield, keywords: ['verification', 'identity'] },
  { id: 'vehicles', label: 'Vehicles', icon: Bike, keywords: ['fleet', 'scooter'] },
  { id: 'rentals', label: 'Rentals', icon: CalendarDays, keywords: ['plans', 'leases'] },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: ArrowLeftRight,
    keywords: ['payments', 'money'],
  },
  {
    id: 'tickets',
    label: 'Support Tickets',
    icon: MessageSquare,
    keywords: ['help', 'support', 'issues'],
  },
  { id: 'offers', label: 'Offers & Coupons', icon: Tag, keywords: ['promotions', 'discounts'] },
  { id: 'rewards', label: 'Rewards', icon: Award, keywords: ['points', 'loyalty'] },
  { id: 'referrals', label: 'Referrals', icon: Share2, keywords: ['invite', 'share'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, keywords: ['alerts', 'messages'] },
  { id: 'team-leaders', label: 'Team Leaders', icon: UserCog, keywords: ['managers', 'staff'] },
  { id: 'faqs', label: 'FAQs', icon: HelpCircle, keywords: ['questions', 'help'] },
  { id: 'legal', label: 'Legal Documents', icon: FileText, keywords: ['terms', 'privacy'] },
  { id: 'settings', label: 'Settings', icon: Settings, keywords: ['config', 'preferences'] },
  { id: 'admin-users', label: 'Admin Users', icon: ShieldCheck, keywords: ['admins', 'access'] },
];

interface PaletteItem {
  id: string;
  label: string;
  icon: any;
  type: 'nav' | 'rider' | 'vehicle';
  keywords?: string[]; // Only for nav
}

export default function CommandPalette() {
  const commandPaletteOpen = useAdminStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useAdminStore((s) => s.setCommandPaletteOpen);
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset query when opening
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setResults([]);
    }
  }, [commandPaletteOpen]);

  // Async Search for Entities
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Search Riders
        const rRes = await fetch(`/api/admin/riders?search=${encodeURIComponent(q)}&limit=3`);
        const rJson = await rRes.json();
        const riderResults = Array.isArray(rJson.data) ? rJson.data : rJson.data?.riders || [];
        const riders = riderResults.map((r: any) => ({
          id: `rider:${r.id}`,
          label: `${r.fullName || r.name} (${r.riderId})`,
          icon: User,
          type: 'rider',
        }));

        // Search Vehicles
        const vRes = await fetch(`/api/admin/vehicles?search=${encodeURIComponent(q)}&limit=3`);
        const vJson = await vRes.json();
        const vehicleResults = Array.isArray(vJson.data) ? vJson.data : vJson.data?.vehicles || [];
        const vehicles = vehicleResults.map((v: any) => ({
          id: `vehicle:${v.id}`,
          label: `${v.model} (${v.vehicleId})`,
          icon: Car,
          type: 'vehicle',
        }));

        setResults([...riders, ...vehicles]);
      } catch (err) {
        logger.error('Palette search error', { error: err });
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredNav = useMemo<PaletteItem[]>(() => {
    if (!query.trim()) return navItems.map((i) => ({ ...i, type: 'nav' }));
    const q = query.toLowerCase();
    return (navItems as any[])
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.id.includes(q) ||
          item.keywords.some((k: string) => k.includes(q))
      )
      .map((i) => ({ ...i, type: 'nav' }));
  }, [query]);

  const allItems = useMemo<PaletteItem[]>(() => {
    return [...filteredNav, ...results];
  }, [filteredNav, results]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length]);

  function handleSelect(item: PaletteItem) {
    if (item.type === 'nav') {
      setActiveSection(item.id);
    } else if (item.type === 'rider') {
      setActiveSection('riders');
      // In a real app we'd trigger a detail view modal
    } else if (item.type === 'vehicle') {
      setActiveSection('vehicles');
    }
    setCommandPaletteOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(allItems[selectedIndex]);
    }
  }

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="p-0 max-w-lg overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        <DialogTitle className="sr-only">Quick Search Commands</DialogTitle>
        <div className="relative border-b dark:border-white/10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50" />
          <Input
            placeholder="Search sections, riders, or vehicles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 rounded-none h-14 text-base focus-visible:ring-0 pl-11 pr-4 bg-transparent"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary opacity-50" />
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto py-2">
          {allItems.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No results found for &quot;{query}&quot;</p>
              <p className="text-xs opacity-60">Try searching by ID, phone, or name</p>
            </div>
          ) : (
            <>
              {allItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                const isEntity = item.type !== 'nav';

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all relative ${
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    <div
                      className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="font-semibold truncate">{item.label}</span>
                      {isEntity && (
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                          {item.type}
                        </span>
                      )}
                    </div>
                    {isSelected && !isEntity && (
                      <kbd className="ml-auto text-[10px] text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded font-mono">
                        JUMP
                      </kbd>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
        <div className="border-t dark:border-white/10 px-4 py-3 flex items-center justify-between text-[10px] text-muted-foreground bg-muted/20">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <kbd className="bg-muted px-1 rounded">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted px-1 rounded">↵</kbd> Select
            </span>
          </div>
          <span className="flex items-center gap-1">Global Search Enabled</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
