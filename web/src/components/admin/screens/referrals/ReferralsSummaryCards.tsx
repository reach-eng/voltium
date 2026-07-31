'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, UserCheck, Users } from 'lucide-react';

interface ReferralsSummaryCardsProps {
  total: number;
  completed: number;
  totalEarningsInRupees: number;
  referralBonus: number;
}

/**
 * R3.7o split — Four referral summary cards.
 *
 * Total Leads (primary), Active Riders (emerald), Total Earnings
 * (blue), Reward per Rider (primary, centred). The last card
 * shows the bonus fetched from /api/admin/settings.
 */
export function ReferralsSummaryCards({
  total,
  completed,
  totalEarningsInRupees,
  referralBonus,
}: ReferralsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="bg-card rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Leads
              </p>
              <p className="text-2xl font-black mt-1">{total}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/5">
              <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Riders
              </p>
              <p className="text-2xl font-black mt-1">{completed}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/5">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Earnings
              </p>
              <p className="text-2xl font-black mt-1">₹{totalEarningsInRupees}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card rounded-xl border shadow-sm">
        <CardContent className="p-6 text-center flex flex-col items-center justify-center bg-primary/5 border-primary/20">
          <p className="text-[10px] font-black uppercase text-primary tracking-widest">
            Reward per rider
          </p>
          <p className="text-3xl font-black text-primary mt-1">₹{referralBonus}</p>
        </CardContent>
      </Card>
    </div>
  );
}
