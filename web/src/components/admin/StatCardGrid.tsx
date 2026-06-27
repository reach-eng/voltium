'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Users, Bike, IndianRupee, ShieldAlert, Clock, AlertTriangle, MessageSquare, CalendarDays } from 'lucide-react';
import { useAdminStore } from '@/store/admin';

interface DashboardStats {
  totalRiders: number;
  activeRiders: number;
  totalVehicles: number;
  availableVehicles: number;
  totalBalance: number;
  totalDeposits: number;
  pendingTransactions: number;
  openTickets: number;
  activeRentals: number;
  totalHubs: number;
  pendingKyc: number;
  pendingGuarantor: number;
  pendingInfoRequired: number;
  totalAdmins: number;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

const statCards: { key: string; label: string; icon: any; route: string; format?: boolean }[] = [
  { key: 'activeRiders', label: 'Active Riders', icon: Users, route: 'riders' },
  { key: 'availableVehicles', label: 'Available Fleet', icon: Bike, route: 'vehicles' },
  { key: 'totalBalance', label: 'Revenue', icon: IndianRupee, route: 'transactions', format: true },
  { key: 'totalDeposits', label: 'Deposits Held', icon: ShieldAlert, route: 'transactions', format: true },
  { key: 'pendingTransactions', label: 'Pending Payouts', icon: Clock, route: 'transactions' },
  { key: 'pendingKyc', label: 'KYC Backlog', icon: AlertTriangle, route: 'kyc' },
  { key: 'openTickets', label: 'Open Tickets', icon: MessageSquare, route: 'tickets' },
  { key: 'activeRentals', label: 'Active Rentals', icon: CalendarDays, route: 'rentals' },
];

interface StatCardGridProps {
  stats: DashboardStats | null;
}

export default function StatCardGrid({ stats }: StatCardGridProps) {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 auto-rows-fr">
      {statCards.map((card) => {
        const value = (stats?.[card.key as keyof DashboardStats] as number) ?? 0;
        const Icon = card.icon;
        const kycInfo =
          card.key === 'pendingKyc' && stats?.pendingInfoRequired
            ? ` (${stats.pendingInfoRequired} need correction)`
            : '';

        return (
          <Card
            key={card.key}
            className="h-full rounded-2xl border-border/50 shadow-sm hover:border-primary/30 transition-all duration-300 cursor-pointer group"
            onClick={() => setActiveSection(card.route)}
          >
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground truncate">
                    {card.label}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    {card.format
                      ? formatINR(value)
                      : value.toLocaleString('en-IN')}
                  </h3>
                  {kycInfo && <p className="text-xs text-muted-foreground">{kycInfo}</p>}
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
