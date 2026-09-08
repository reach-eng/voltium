'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface SosAlertProps {
  count: number;
  /** False when the SOS fetch failed — data unknown, stay silent. */
  confirmed?: boolean;
  onGoToTickets: () => void;
}

/**
 * R3.7z split — emergency SOS banner. Renders nothing when count is 0.
 */
export function SosAlert({ count, confirmed = true, onGoToTickets }: SosAlertProps) {
  // Never reassure "no emergency" while the data is unknown (fetch
  // failed). Render nothing until the state is confirmed.
  if (!confirmed) {
    return null;
  }
  if (count <= 0) return null;
  return (
    <div
      className="animate-in fade-in slide-in-from-top-4 duration-500"
      role="alert"
      aria-live="assertive"
    >
      <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5 shadow-lg shadow-rose-500/10 overflow-hidden ring-1 ring-rose-500/20">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative" aria-hidden="true">
              <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-25" />
              <div className="relative w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/40">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h4 className="text-xl font-bold text-rose-600 dark:text-rose-400">
                Emergency SOS Detected
              </h4>
              <p className="text-sm text-rose-500 dark:text-rose-400 font-medium">
                {count} emergency SOS {count === 1 ? 'alert' : 'alerts'} in the
                last 24 hours {count === 1 ? 'needs' : 'need'} follow-up
              </p>
            </div>
          </div>
          <Button
            onClick={onGoToTickets}
            className="rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 px-8"
          >
            Go to SOS Hub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
