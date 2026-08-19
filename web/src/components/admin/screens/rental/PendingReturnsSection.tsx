'use client';

import { Camera, History, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { countSubmittedPhotos, riderDisplayName, type ActiveRental } from './types';

interface PendingReturnsSectionProps {
  pendingReturns: ActiveRental[];
  saving: boolean;
  pendingApproveId: string | null;
  onReview: (rental: ActiveRental) => void;
  onApprove: (rental: ActiveRental) => void;
}

/**
 * R3.7y split — pending return approvals banner + cards.
 *
 * Renders only when there are pending returns. Each card exposes
 * Review (opens the photo dialog) and Approve (opens the confirm).
 */
export function PendingReturnsSection({
  pendingReturns,
  saving,
  pendingApproveId,
  onReview,
  onApprove,
}: PendingReturnsSectionProps) {
  if (pendingReturns.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
          <History className="w-5 h-5 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Pending Return Approvals
          <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold">
            {pendingReturns.length}
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {pendingReturns.map((rental) => (
          <Card
            key={rental.id}
            className="rounded-xl border-rose-200 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 overflow-hidden shadow-sm hover:shadow-md transition-all"
          >
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-foreground">
                    {riderDisplayName(rental)}
                  </h3>
                  <p className="text-xs text-muted-foreground">{rental.phone}</p>
                </div>
                <Badge className="bg-rose-500 hover:bg-rose-600 border-none">
                  Pending Review
                </Badge>
              </div>

              <div className="bg-white/60 dark:bg-slate-900/60 rounded-xl p-3 border border-rose-100/50 dark:border-rose-900/30">
                <p className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 mb-1">
                  Scooter Submitted On
                </p>
                <p className="text-sm font-semibold">
                  {rental.submissionDate
                    ? formatDateTimeDDMMYYYY(rental.submissionDate)
                    : 'Today'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Camera className="w-3 h-3 text-rose-500" />
                  <p className="text-[10px] text-rose-500 font-bold uppercase">
                    {countSubmittedPhotos(rental)} Photos Uploaded
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-lg"
                  onClick={() => onReview(rental)}
                >
                  Review
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                  disabled={saving}
                  onClick={() => onApprove(rental)}
                >
                  {saving && pendingApproveId === rental.id ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : null}
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
