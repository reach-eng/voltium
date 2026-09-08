'use client';

import { Clock, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatLogTime, type AuditLogEntry } from './types';

interface ActivityStreamProps {
  logs: AuditLogEntry[];
  adminNames: Map<string, string>;
  /** P1: role lacks audit access — say so instead of "No recent activity". */
  accessDenied?: boolean;
}

function getActionDot(action: string | null | undefined): string {
  const a = (action ?? '').toLowerCase();
  if (a.includes('delete') || a.includes('remove')) return 'bg-rose-500';
  if (a.includes('update') || a.includes('edit')) return 'bg-primary';
  return 'bg-emerald-500';
}

function humanizeAction(action: string | null | undefined): string {
  if (!action) return 'Unknown action';
  return action
    .split(/[._]/)
    .map((w) =>
      // P2: keep well-known acronyms (SOS) instead of "Sos".
      w.toUpperCase() === 'SOS'
        ? 'SOS'
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(' ');
}

function actorName(log: AuditLogEntry, adminNames: Map<string, string>): string {
  if (!log.actorId) return 'System';
  return adminNames.get(log.actorId) || 'Admin';
}

/**
 * R3.7z split — audit-log activity stream sidebar.
 */
export function ActivityStream({ logs, adminNames, accessDenied = false }: ActivityStreamProps) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="border-b bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Activity Stream
        </CardTitle>
        <Badge
          variant="outline"
          className="text-[10px] uppercase font-bold text-muted-foreground"
        >
          Live
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-4 space-y-6">
            {accessDenied ? (
              <div className="text-center py-10 opacity-40">
                <Clock className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Your role has no access to the audit log.</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10 opacity-40">
                <Clock className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              logs.map((log, i) => {
                const name = actorName(log, adminNames);
                return (
                  <div key={log.id} className="relative pl-6 pb-2">
                    {i !== logs.length - 1 && (
                      <div className="absolute left-[7px] top-[14px] bottom-0 w-[2px] bg-border/40" />
                    )}
                    <div
                      className={`absolute left-0 top-[2px] w-[16px] h-[16px] rounded-full border-4 border-background shadow-sm ${getActionDot(log.action)}`}
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-bold leading-none tracking-tight">
                        {humanizeAction(log.action)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.entity ?? 'entity'}{' '}
                        <span className="font-mono text-[10px] opacity-70">
                          #{String(log.entityId ?? '').slice(-6) || '—'}
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px] rounded-sm opacity-80"
                        >
                          {name}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/80 italic">
                          {formatLogTime(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
