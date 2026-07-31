'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Key, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatKeyLabel } from './formatKey';

interface ReadOnlyStatusGridProps {
  readOnly: Record<string, string>;
}

/**
 * R3.7k split — Read-only server & security status grid.
 *
 * Three-column responsive grid where each cell picks an icon based
 * on the key name (DATABASE_HOST → DB, SECRET/JWT → key, CONFIGURED
 * → shield). The value's text colour is emerald for "true" (configured),
 * amber for "enabled", muted for "disabled", blue for "localhost",
 * default otherwise.
 */
export function ReadOnlyStatusGrid({ readOnly }: ReadOnlyStatusGridProps) {
  return (
    <Card className="rounded-xl border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-base">Server &amp; Security Status</CardTitle>
          <CardDescription className="ml-2">
            Read-only — configured via environment variables
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(readOnly).map(([key, value]) => (
            <ReadOnlyCell key={key} keyName={key} value={value} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** One cell in the read-only grid. */
function ReadOnlyCell({ keyName, value }: { keyName: string; value: string }) {
  const isConfigured = value === 'true';
  const isEnabled = value === 'enabled';
  const isDisabled = value === 'disabled';
  const isLocalhost = value === 'localhost';

  let icon = <Server className="w-3.5 h-3.5" />;
  let badgeVariant: 'outline' | 'configured' | 'missing' = 'outline';

  if (keyName.includes('CONFIGURED')) {
    icon = isConfigured ? (
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
    ) : (
      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
    );
    badgeVariant = isConfigured ? 'configured' : 'missing';
  } else if (keyName.includes('_OTP') || keyName.includes('_LOGIN')) {
    icon = isEnabled ? (
      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
    ) : (
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
    );
  } else if (keyName === 'DATABASE_HOST') {
    icon = <Database className="w-3.5 h-3.5" />;
  } else if (keyName.includes('SECRET') || keyName.includes('JWT')) {
    icon = <Key className="w-3.5 h-3.5" />;
  }

  const valueClass = isConfigured
    ? 'text-emerald-600 dark:text-emerald-400'
    : isEnabled
      ? 'text-amber-600 dark:text-amber-400'
      : isDisabled
        ? 'text-muted-foreground'
        : isLocalhost
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-foreground';

  const badgeClass =
    badgeVariant === 'configured'
      ? 'bg-emerald-500/10 text-emerald-600'
      : badgeVariant === 'missing'
        ? 'bg-rose-500/10 text-rose-600'
        : '';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border text-sm">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{formatKeyLabel(keyName)}</p>
        <p className={`text-xs mt-0.5 font-mono ${valueClass}`}>{value}</p>
      </div>
      {badgeVariant !== 'outline' && (
        <Badge variant="outline" className={`text-[8px] ${badgeClass}`}>
          {isConfigured ? 'Configured' : 'Missing'}
        </Badge>
      )}
    </div>
  );
}
