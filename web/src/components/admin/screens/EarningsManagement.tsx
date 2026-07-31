'use client';

import { useEarnings } from './earnings/useEarnings';
import { EarningsHeader } from './earnings/EarningsHeader';
import { EarningsSummaryCards } from './earnings/EarningsSummaryCards';
import { EarningsFiltersBar } from './earnings/EarningsFiltersBar';
import { EarningsTable } from './earnings/EarningsTable';

/**
 * R3.7h split — Earnings management shell.
 *
 * Pre-split: 11.1 KB / 326 lines with 13 useState + 1 fetch + 3 cards
 * + filters + table + pagination all inline.
 * Post-split: thin orchestrator that wires the data hook and the 4
 * subcomponents. State + fetch live in `useEarnings` (3.1 KB); the
 * rest live in focused files under `earnings/`.
 */
export default function EarningsManagement() {
  const e = useEarnings();
  return (
    <div className="space-y-6">
      <EarningsHeader />
      <EarningsSummaryCards summary={e.summary} />
      <EarningsFiltersBar
        search={e.search}
        setSearch={e.setSearch}
        platform={e.platform}
        setPlatform={e.setPlatform}
        startDate={e.startDate}
        setStartDate={e.setStartDate}
        endDate={e.endDate}
        setEndDate={e.setEndDate}
      />
      <EarningsTable
        loading={e.loading}
        earnings={e.earnings}
        page={e.page}
        totalPages={e.totalPages}
        total={e.total}
        onPageChange={e.setPage}
      />
    </div>
  );
}
