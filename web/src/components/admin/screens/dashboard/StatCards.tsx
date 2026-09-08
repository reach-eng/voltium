'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatINR, STAT_CARDS, type DashboardStats } from './types';

interface StatCardsProps {
  stats: DashboardStats | null;
  onCardClick: (route: string) => void;
}

/**
 * R3.7z split — 9-tile clickable stat grid. Each card navigates
 * to the relevant section.
 */
export function StatCards({ stats, onCardClick }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 auto-rows-fr">
      {STAT_CARDS.map((card) => {
        const raw = stats?.[card.key];
        // P2: non-finite (NaN/undefined) renders as ₹0 vs "NaN" — show an
        // em dash so missing data is never mistaken for a real zero.
        const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
        const Icon = card.icon;
        const kycInfo =
          card.key === 'pendingKyc' && stats?.pendingInfoRequired
            ? ` (${stats.pendingInfoRequired} need correction)`
            : '';
        const display =
          value === null
            ? '—'
            : card.format === 'inr'
              ? formatINR(value)
              : value.toLocaleString('en-IN');

        return (
          <Card
            key={card.key as string}
            className="h-full rounded-2xl border-border/50 shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            onClick={() => onCardClick(card.route)}
            role="button"
            tabIndex={0}
            aria-label={`${card.label}: ${display}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardClick(card.route);
              }
            }}
          >
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground truncate">
                    {card.label}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                    {display}
                  </h3>
                  {kycInfo && <p className="text-xs text-muted-foreground">{kycInfo}</p>}
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
