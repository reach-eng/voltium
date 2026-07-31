'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Award } from 'lucide-react';
import { getRiskBadgeClass, getRiskIcon, getScoreColor, type RiderScore } from './types';

interface LeaderboardTableProps {
  scores: RiderScore[];
}

/** Tailwind chip styles for the top-3 rank circles. */
function getRankClass(idx: number): string {
  if (idx === 0) return 'bg-amber-500/20 text-amber-600';
  if (idx === 1) return 'bg-slate-400/20 text-slate-600';
  if (idx === 2) return 'bg-orange-500/20 text-orange-600';
  return 'bg-muted text-muted-foreground';
}

/**
 * R3 split (RiderScoringScreen) — top-20 leaderboard.
 *
 * Seven columns: Rank (1/2/3 get a gold/silver/bronze chip),
 * Rider, Composite, Risk Level, then three sub-scores. Header
 * card shows the title + Award icon. Renders an empty state
 * when no scores are loaded.
 */
export function LeaderboardTable({ scores }: LeaderboardTableProps) {
  return (
    <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
      <CardHeader className="pb-3 px-6 pt-5">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Top 20 Riders by Composite Score
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="px-6 w-16">Rank</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead>Composite Score</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              scores.map((s, idx) => {
                const RiskIcon = getRiskIcon(s.riskLevel);
                return (
                  <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="px-6">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankClass(idx)}`}
                      >
                        {idx + 1}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-sm font-semibold">{s.fullName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.riderId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-lg font-bold ${getScoreColor(s.compositeScore)}`}>
                        {s.compositeScore}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-md text-[10px] font-bold uppercase ${getRiskBadgeClass(s.riskLevel)}`}
                      >
                        <RiskIcon className="w-3 h-3 mr-1" />
                        {s.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-semibold ${getScoreColor(s.paymentScore)}`}>
                        {s.paymentScore}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-semibold ${getScoreColor(s.complianceScore)}`}>
                        {s.complianceScore}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-semibold ${getScoreColor(s.engagementScore)}`}>
                        {s.engagementScore}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
