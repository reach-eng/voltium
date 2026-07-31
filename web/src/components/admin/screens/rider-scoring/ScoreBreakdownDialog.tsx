'use client';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MapPin,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { getRiskBadgeClass, getRiskIcon, getScoreBarColor, getScoreColor, type RiderScore } from './types';

interface ScoreBreakdownDialogProps {
  score: RiderScore | null;
  onOpenChange: (open: boolean) => void;
}

/** Sub-score row metadata. */
const SUB_SCORES = [
  { key: 'paymentScore', label: 'Payment History', icon: TrendingUp },
  { key: 'complianceScore', label: 'Compliance', icon: ShieldCheck },
  { key: 'engagementScore', label: 'Engagement', icon: TrendingDown },
  { key: 'vehicleScore', label: 'Vehicle Health', icon: Target },
  { key: 'locationScore', label: 'Location Accuracy', icon: MapPin },
] as const;

/**
 * R3 split (RiderScoringScreen) — score breakdown dialog.
 *
 * Header: name + rider ID + composite score + risk badge. Body:
 * five sub-score rows (Payment / Compliance / Engagement /
 * Vehicle / Location), each with a coloured progress bar and
 * the numeric value. Footer: phone, hub, last calculated.
 */
export function ScoreBreakdownDialog({ score, onOpenChange }: ScoreBreakdownDialogProps) {
  return (
    <Dialog
      open={!!score}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Score Breakdown
          </DialogTitle>
        </DialogHeader>
        {score && <ScoreBreakdownBody score={score} />}
      </DialogContent>
    </Dialog>
  );
}

/** Body of the dialog — extracted so it can render a non-null score. */
function ScoreBreakdownBody({ score }: { score: RiderScore }) {
  const RiskIcon = getRiskIcon(score.riskLevel);
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
        <div>
          <p className="text-sm font-semibold">{score.fullName || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground font-mono">{score.riderId}</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${getScoreColor(score.compositeScore)}`}>
            {score.compositeScore}
          </p>
          <Badge
            variant="outline"
            className={`rounded-md text-xs font-bold uppercase mt-1 ${getRiskBadgeClass(score.riskLevel)}`}
          >
            <RiskIcon className="w-3 h-3 mr-1" />
            {score.riskLevel}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Sub-Scores</p>
        {SUB_SCORES.map((sub) => {
          const Icon = sub.icon;
          const value = score[sub.key];
          return (
            <div key={sub.key} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{sub.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getScoreBarColor(value)}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className={`text-sm font-bold w-8 text-right ${getScoreColor(value)}`}>
                  {value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 text-sm pt-2 border-t">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Phone</span>
          <span className="font-medium">{score.phone}</span>
        </div>
        {score.pickupHub && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hub</span>
            <span>{score.pickupHub}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Last Calculated</span>
          <span>{formatDateDDMMYYYY(score.lastCalculated)}</span>
        </div>
      </div>
    </div>
  );
}
