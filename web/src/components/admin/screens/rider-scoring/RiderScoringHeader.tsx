'use client';

import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Target } from 'lucide-react';

interface RiderScoringHeaderProps {
  recalculating: boolean;
  onRecalculate: () => void;
}

/**
 * R3 split (RiderScoringScreen) — header.
 *
 * H2 + Target icon + subtitle on the left; Recalculate All
 * button on the right that shows a spinner while the POST is
 * in flight.
 */
export function RiderScoringHeader({ recalculating, onRecalculate }: RiderScoringHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          Rider Scoring
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Composite risk scores and performance metrics
        </p>
      </div>
      <Button
        size="sm"
        className="rounded-full px-4 h-9"
        onClick={onRecalculate}
        disabled={recalculating}
      >
        {recalculating ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4 mr-2" />
        )}
        Recalculate All
      </Button>
    </div>
  );
}
