'use client';

import { useReferrals } from './referrals/useReferrals';
import { ReferralsHeader } from './referrals/ReferralsHeader';
import { IssueReferralDialog } from './referrals/IssueReferralDialog';
import { ReferralsSummaryCards } from './referrals/ReferralsSummaryCards';
import { ReferralsFiltersBar } from './referrals/ReferralsFiltersBar';
import { ReferralsTable } from './referrals/ReferralsTable';

/**
 * R3.7o split — Referral management shell.
 *
 * Pre-split: 18.1 KB / 504 lines with 14 useState + 3 fetch + create
 * handler + 4 cards + filters + table + pagination + dialog all inline.
 * Post-split: thin orchestrator that wires the data hook and 5
 * subcomponents. State machine + all network logic live in
 * `useReferrals` (5.8 KB); the rest live in focused files under
 * `referrals/`.
 */
export default function ReferralManagement() {
  const r = useReferrals();

  return (
    <div className="space-y-6 px-4">
      <ReferralsHeader onIssueClick={() => r.setShowCreateModal(true)} />

      <IssueReferralDialog
        open={r.showCreateModal}
        onOpenChange={r.setShowCreateModal}
        riders={r.riders}
        riderSearch={r.riderSearch}
        setRiderSearch={r.setRiderSearch}
        referrerId={r.referrerId}
        setReferrerId={r.setReferrerId}
        refereeId={r.refereeId}
        setRefereeId={r.setRefereeId}
        isSubmitting={r.isSubmitting}
        onSubmit={r.handleCreateReferral}
      />

      <ReferralsSummaryCards
        total={r.stats.total}
        completed={r.stats.completed}
        totalEarningsInRupees={r.stats.totalEarningsInRupees}
        referralBonus={r.referralBonus}
      />

      <ReferralsFiltersBar
        search={r.search}
        setSearch={r.setSearch}
        filter={r.filter}
        setFilter={r.setFilter}
        onPageReset={() => r.setPage(1)}
      />

      <ReferralsTable
        loading={r.loading}
        referrals={r.referrals}
        page={r.page}
        totalPages={r.totalPages}
        onPageChange={r.setPage}
      />
    </div>
  );
}
