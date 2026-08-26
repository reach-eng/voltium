'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server } from 'lucide-react';
import type { ServerHealth } from './types';

interface ServicesDaemonsCardProps {
  health: ServerHealth;
}

/**
 * R3.7i split — Services & Daemons card.
 *
 * Three rows: PostgreSQL (RUNNING/DOWN), PM2 (ONLINE/DEGRADED), Caddy
 * (always ACTIVE — not externally probed). Each row has a status
 * badge and a small help-text line below.
 */
export function ServicesDaemonsCard({ health }: ServicesDaemonsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-base font-bold">Services &amp; Daemons</CardTitle>
        <Server className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">PostgreSQL Database</span>
          <Badge
            className={
              health.databaseStatus === 'RUNNING'
                ? 'bg-emerald-600 text-white'
                : 'bg-destructive text-white'
            }
          >
            {health.databaseStatus}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">{health.database}</div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">PM2 Processes</span>
          <Badge
            className={
              health.pm2StatusBadge === 'ONLINE'
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 text-white'
            }
          >
            {health.pm2StatusBadge}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">{health.pm2Status}</div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">Caddy Reverse Proxy</span>
          <Badge className="bg-emerald-600 text-white">ACTIVE</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
