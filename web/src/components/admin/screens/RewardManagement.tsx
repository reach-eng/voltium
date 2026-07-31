'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ReferralManagement from './ReferralManagement';
import { useRewards } from './rewards/useRewards';
import { RewardsHeader } from './rewards/RewardsHeader';
import { AwardPointsForm } from './rewards/AwardPointsForm';
import { RewardsSummaryCards } from './rewards/RewardsSummaryCards';
import { RewardsTable } from './rewards/RewardsTable';

/**
 * R3.7l split — Reward management shell.
 *
 * Pre-split: 14.6 KB / 444 lines with Tabs + 14 useState + 3 fetch +
 * award handler + summary + table + pagination all inline.
 * Post-split: thin orchestrator that wires the data hook and 4
 * subcomponents. State machine + all fetch logic live in `useRewards`
 * (4.8 KB); the rest live in focused files under `rewards/`.
 */
function RewardsTab() {
  const r = useRewards();
  return (
    <div className="space-y-6">
      <RewardsHeader showForm={r.showForm} onToggleForm={() => r.setShowForm(!r.showForm)} />

      {r.showForm && (
        <AwardPointsForm
          riders={r.riders}
          riderSearch={r.riderSearch}
          setRiderSearch={r.setRiderSearch}
          selectedRider={r.selectedRider}
          setSelectedRider={r.setSelectedRider}
          title={r.title}
          setTitle={r.setTitle}
          points={r.points}
          setPoints={r.setPoints}
          isSubmitting={r.isSubmitting}
          onSubmit={r.handleAwardPoints}
        />
      )}

      <RewardsSummaryCards summary={r.summary} />

      <RewardsTable
        loading={r.loading}
        rewards={r.rewards}
        search={r.search}
        setSearch={r.setSearch}
        page={r.page}
        totalPages={r.totalPages}
        totalCount={r.totalCount}
        onPageChange={r.setPage}
      />
    </div>
  );
}

export default function RewardManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Rewards</h2>
        <p className="text-muted-foreground text-sm">
          Manage loyalty points and track the referral program.
        </p>
      </div>
      <Tabs defaultValue="rewards" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="rewards" className="text-xs px-5 font-semibold">
            Loyalty Points
          </TabsTrigger>
          <TabsTrigger value="referrals" className="text-xs px-5 font-semibold">
            Referral Program
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rewards">
          <RewardsTab />
        </TabsContent>
        <TabsContent value="referrals">
          <ReferralManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
