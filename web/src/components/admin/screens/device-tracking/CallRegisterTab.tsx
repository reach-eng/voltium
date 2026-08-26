'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Phone,
  PhoneMissed,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import type { CallLog } from './types';

interface CallRegisterTabProps {
  calls: CallLog[] | undefined;
}

function callIconBg(type: CallLog['type']): string {
  if (type === 'INCOMING') return 'bg-emerald-500/10 text-emerald-600';
  if (type === 'OUTGOING') return 'bg-blue-500/10 text-blue-600';
  return 'bg-rose-500/10 text-rose-600';
}

function CallTypeIcon({ type }: { type: CallLog['type'] }) {
  if (type === 'INCOMING') return <ArrowDownLeft className="w-4 h-4" />;
  if (type === 'OUTGOING') return <ArrowUpRight className="w-4 h-4" />;
  return <PhoneMissed className="w-4 h-4" />;
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * R3.7bb split — Call Register sub-tab.
 */
export function CallRegisterTab({ calls }: CallRegisterTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
          Recent Call Logs
        </h4>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          {calls?.length || 0} Registered
        </Badge>
      </div>
      <div className="space-y-2">
        {calls?.map((call, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2.5 rounded-xl border bg-card/50 hover:border-primary/30 transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center ${callIconBg(call.type)}`}
              >
                <CallTypeIcon type={call.type} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground/90 tabular-nums">
                  {call.name || call.number}
                </p>
                <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/60 tabular-nums">
                  {call.number}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-muted-foreground uppercase tabular-nums">
                <Clock className="w-3 h-3" />
                {formatDuration(call.duration)}
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono tabular-nums">
                {formatDateTimeDDMMYYYY(call.timestamp)}
              </p>
            </div>
          </div>
        ))}
        {(!calls || calls.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border border-dashed text-muted-foreground">
            <Phone className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-sm font-bold">No call history synced</p>
          </div>
        )}
      </div>
    </div>
  );
}
