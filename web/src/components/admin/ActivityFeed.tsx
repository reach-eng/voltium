'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Clock } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorId: string | null;
  details: any;
  createdAt: string;
}

interface ActivityFeedProps {
  logs: AuditLogEntry[];
  adminNames: Map<string, string>;
}

export default function ActivityFeed({ logs, adminNames }: ActivityFeedProps) {
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
            {logs.length === 0 ? (
              <div className="text-center py-10 opacity-40">
                <Clock className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              logs.map((log, i) => {
                const actorName = log.actorId
                  ? adminNames.get(log.actorId) || `Admin ${log.actorId.slice(-4)}`
                  : 'System';
                return (
                  <div key={log.id} className="relative pl-6 pb-2">
                    {i !== logs.length - 1 && (
                      <div className="absolute left-[7px] top-[14px] bottom-0 w-[2px] bg-border/40" />
                    )}
                    <div
                      className={`absolute left-0 top-[2px] w-[16px] h-[16px] rounded-full border-4 border-background shadow-sm ${
                        log.action.includes('delete')
                          ? 'bg-rose-500'
                          : log.action.includes('update')
                            ? 'bg-primary'
                            : 'bg-emerald-500'
                      }`}
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-bold leading-none tracking-tight">
                        {log.action
                          .split('.')
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.entity}{' '}
                        <span className="font-mono text-[10px] opacity-70">
                          #{log.entityId.slice(-6)}
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px] rounded-sm opacity-80"
                        >
                          {actorName}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/80 italic">
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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
