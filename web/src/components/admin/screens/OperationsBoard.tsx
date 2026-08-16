'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  UserCheck,
  Bike,
  AlertCircle,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { useAdminStore } from '@/store/admin';
import { useOperations } from './useOperations';

function OperationsOverviewTab() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const { stats, loading, error, refresh } = useOperations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Operations Board</h2>
          <p className="text-muted-foreground text-sm">
            Real-time daily workflow board and business stats checklist.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 border border-rose-500/30 bg-rose-500/10 rounded-xl flex items-center justify-between text-rose-600 dark:text-rose-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card
          className="bg-primary/5 border-primary/20 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => setActiveSection('rentals')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Rentals
            </CardTitle>
            <Bike className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.activeRentals ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card
          className="bg-emerald-500/5 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 transition-colors"
          onClick={() => setActiveSection('kyc')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending KYC
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.pendingKyc ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card
          className="bg-amber-500/5 border-amber-500/20 cursor-pointer hover:bg-amber-500/10 transition-colors"
          onClick={() => setActiveSection('deposits')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Deposits
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.pendingDeposits ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card
          className="bg-sky-500/5 border-sky-500/20 cursor-pointer hover:bg-sky-500/10 transition-colors"
          onClick={() => setActiveSection('vehicles')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Available Bikes
            </CardTitle>
            <Bike className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.availableVehicles ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card
          className="bg-rose-500/5 border-rose-500/20 cursor-pointer hover:bg-rose-500/10 transition-colors"
          onClick={() => setActiveSection('tickets')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Open Tickets
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.openTickets ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Action Items Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground border rounded-xl border-dashed">
              No action items currently pending.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hub Utilization Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground border rounded-xl border-dashed">
              No hub utilization data available.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OperationsBoard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Operations</h2>
        <p className="text-muted-foreground text-sm">
          Daily operational overview, action items, and vehicle pickup &amp; return workflow.
        </p>
      </div>
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="overview" className="text-xs px-5 font-semibold">
            Overview
          </TabsTrigger>
          <TabsTrigger value="pickup-return" className="text-xs px-5 font-semibold">
            Pickup &amp; Return
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OperationsOverviewTab />
        </TabsContent>
        <TabsContent value="pickup-return">
          <div className="p-6 border rounded-xl bg-card text-card-foreground">
            <h3 className="text-lg font-semibold mb-2">Pickup &amp; Return Workflow</h3>
            <p className="text-sm text-muted-foreground">
              Vehicle pickup schedule and return inspections queue.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
