'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, UserCheck, Bike, AlertCircle, MessageSquare } from 'lucide-react';

export default function OperationsBoard() {
  const [stats] = useState({
    activeRentals: 42,
    pendingKyc: 5,
    pendingDeposits: 3,
    availableVehicles: 18,
    openTickets: 4,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Operations Board</h2>
        <p className="text-muted-foreground">Real-time daily workflow board and business stats checklist.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Rentals</CardTitle>
            <Bike className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRentals}</div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending KYC</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingKyc}</div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Deposits</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeposits}</div>
          </CardContent>
        </Card>

        <Card className="bg-sky-500/5 border-sky-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Bikes</CardTitle>
            <Bike className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.availableVehicles}</div>
          </CardContent>
        </Card>

        <Card className="bg-rose-500/5 border-rose-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open Tickets</CardTitle>
            <MessageSquare className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openTickets}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Action Items Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 border rounded-xl bg-amber-500/5 border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-bold">KYC Validation Queue:</span> 5 riders are waiting for guarantor field verification.
              </div>
              <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-500/10">Resolve</Button>
            </div>

            <div className="flex items-center gap-3 p-3 border rounded-xl bg-rose-500/5 border-rose-200">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-bold">Overdue Returns:</span> V-1002 is overdue by 3 days. Contact team leader for inspection.
              </div>
              <Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-500/10">View details</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hub Utilization Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Koramangala Hub</span>
                <span className="font-bold">85% (17/20)</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '85%' }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>HSR Layout Hub</span>
                <span className="font-bold">45% (9/20)</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: '45%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
