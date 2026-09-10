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
 * Three-column responsive grid where each cell picks an icon + value
 * style from a per-key matcher. P3-6 (system-settings audit,
 * 2026-09-08): the previous version matched `value === 'true'`,
 * `value === 'enabled'`, etc. as string literals scattered through
 * the JSX. A new env value (e.g. `OTP = '1'`) rendered default-styled
 * with a potentially wrong icon. The data-driven map below lists
 * every recognised key + value, and the default branch renders
 * neutral (no false-positive styling).
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

/** Status tone — the colour + icon family for a single (key, value)
 *  pair. Adding a new env value? Add an entry to `STATUS_BY_KEY` and
 *  the icon will follow. Default tone is `neutral` so a typo'd
 *  value never lights up green by accident. */
type StatusTone = 'configured' | 'missing' | 'enabled' | 'disabled' | 'localhost' | 'neutral';

interface StatusConfig {
  tone: StatusTone;
  icon: 'shield' | 'shieldInverted' | 'db' | 'key' | 'server';
}

/** P3-6: data-driven (key, value) → status. First match wins. */
const STATUS_BY_KEY: Array<{
  keyPredicate: (k: string) => boolean;
  valuePredicate: (v: string) => boolean;
  config: StatusConfig;
}> = [
  // *_CONFIGURED → "true" = configured (emerald shield), anything else = missing (rose shield).
  {
    keyPredicate: (k) => k.includes('CONFIGURED'),
    valuePredicate: (v) => v === 'true',
    config: { tone: 'configured', icon: 'shield' },
  },
  {
    keyPredicate: (k) => k.includes('CONFIGURED'),
    valuePredicate: (v) => v !== 'true',
    config: { tone: 'missing', icon: 'shieldInverted' },
  },
  // ENABLE_*_OTP / ENABLE_*_LOGIN → "enabled" = amber shield, "disabled" = emerald.
  {
    keyPredicate: (k) => k.includes('_OTP') || k.includes('_LOGIN'),
    valuePredicate: (v) => v === 'enabled',
    config: { tone: 'enabled', icon: 'shield' },
  },
  {
    keyPredicate: (k) => k.includes('_OTP') || k.includes('_LOGIN'),
    valuePredicate: (v) => v === 'disabled',
    config: { tone: 'disabled', icon: 'shieldInverted' },
  },
  // DATABASE_HOST = "localhost" = blue.
  {
    keyPredicate: (k) => k === 'DATABASE_HOST',
    valuePredicate: (v) => v === 'localhost',
    config: { tone: 'localhost', icon: 'db' },
  },
  // *_SECRET / JWT_* → key icon (neutral tone).
  {
    keyPredicate: (k) => k.includes('SECRET') || k.includes('JWT'),
    valuePredicate: () => true,
    config: { tone: 'neutral', icon: 'key' },
  },
  // STORAGE_PROVIDER / DATA_MODE / NODE_ENV / APP_ENV → server icon, neutral.
  {
    keyPredicate: (k) => k === 'STORAGE_PROVIDER' || k === 'DATA_MODE' || k === 'NODE_ENV' || k === 'APP_ENV',
    valuePredicate: () => true,
    config: { tone: 'neutral', icon: 'server' },
  },
];

const DEFAULT_STATUS: StatusConfig = { tone: 'neutral', icon: 'server' };

function resolveStatus(key: string, value: string): StatusConfig {
  for (const rule of STATUS_BY_KEY) {
    if (rule.keyPredicate(key) && rule.valuePredicate(value)) {
      return rule.config;
    }
  }
  return DEFAULT_STATUS;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  configured: 'text-emerald-600 dark:text-emerald-400',
  missing: 'text-rose-600 dark:text-rose-400',
  enabled: 'text-amber-600 dark:text-amber-400',
  disabled: 'text-muted-foreground',
  localhost: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-foreground',
};

const TONE_BADGE: Record<StatusTone, { className: string; label: string } | null> = {
  configured: { className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Configured' },
  missing: { className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', label: 'Missing' },
  enabled: null,
  disabled: null,
  localhost: null,
  neutral: null,
};

/** One cell in the read-only grid. */
function ReadOnlyCell({ keyName, value }: { keyName: string; value: string }) {
  const { tone, icon } = resolveStatus(keyName, value);
  const badge = TONE_BADGE[tone];

  const iconEl = (() => {
    switch (icon) {
      case 'shield':
        return tone === 'missing'
          ? <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />;
      case 'shieldInverted':
        return tone === 'enabled'
          ? <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />;
      case 'db':
        return <Database className="w-3.5 h-3.5" />;
      case 'key':
        return <Key className="w-3.5 h-3.5" />;
      default:
        return <Server className="w-3.5 h-3.5" />;
    }
  })();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border text-sm">
      <div className="shrink-0">{iconEl}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{formatKeyLabel(keyName)}</p>
        <p className={`text-xs mt-0.5 font-mono ${TONE_CLASSES[tone]}`}>{value}</p>
      </div>
      {badge && (
        <Badge variant="outline" className={`text-[8px] ${badge.className}`}>
          {badge.label}
        </Badge>
      )}
    </div>
  );
}
