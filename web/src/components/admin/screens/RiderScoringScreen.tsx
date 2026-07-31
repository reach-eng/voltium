'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useRiderScoring } from './rider-scoring/useRiderScoring';
import { RiderScoringHeader } from './rider-scoring/RiderScoringHeader';
import { RiskSummaryCards } from './rider-scoring/RiskSummaryCards';
import { RiderScoringFilters } from './rider-scoring/RiderScoringFilters';
import { ScoresTable } from './rider-scoring/ScoresTable';
import { LeaderboardTable } from './rider-scoring/LeaderboardTable';
import { ScoreBreakdownDialog } from './rider-scoring/ScoreBreakdownDialog';
import type { RiderScore } from './rider-scoring/types';

/**
 * R3 split (RiderScoringScreen) — shell.
 *
 * Pre-split: 25.7 KB / 652 lines with 12 useState + 1 fetch +
 * recalculate + 5 helper functions + 4 sections all inline.
 * Post-split: thin orchestrator that wires the data hook and
 * 6 subcomponents. All state + network logic lives in
 * `useRiderScoring` (4.2 KB); the 5 risk helpers live in
 * `types.ts` (2.6 KB).
 */
export default function RiderScoringScreen() {
  const s = useRiderScoring();
  const [selectedScore, setSelectedScore] = useState<RiderScore | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (score: RiderScore) => {
    setSelectedScore(score);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <RiderScoringHeader
        recalculating={s.recalculating}
        onRecalculate={s.handleRecalculateAll}
      />

      <RiskSummaryCards
        low={s.riskCounts.LOW}
        medium={s.riskCounts.MEDIUM}
        high={s.riskCounts.HIGH}
        critical={s.riskCounts.CRITICAL}
      />

      <RiderScoringFilters
        riskFilter={s.riskFilter}
        setRiskFilter={s.setRiskFilter}
        search={s.search}
        setSearch={s.setSearch}
      />

      <Tabs value={s.activeTab} onValueChange={s.setActiveTab}>
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          <TabsTrigger
            value="scores"
            className="rounded-lg text-xs font-bold uppercase tracking-tight h-8 px-4"
          >
            Scores Table
          </TabsTrigger>
          <TabsTrigger
            value="leaderboard"
            className="rounded-lg text-xs font-bold uppercase tracking-tight h-8 px-4"
          >
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-4">
          <ScoresTable
            loading={s.loading}
            scores={s.scores}
            page={s.page}
            totalPages={s.totalPages}
            total={s.total}
            onPageChange={s.setPage}
            onOpenDetail={openDetail}
          />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <LeaderboardTable scores={s.leaderboard} />
        </TabsContent>
      </Tabs>

      <ScoreBreakdownDialog
        score={selectedScore}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setSelectedScore(null);
          }
        }}
      />
    </div>
  );
}
