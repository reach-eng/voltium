'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw, Sparkles } from 'lucide-react';

interface BackgroundJobsHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

/**
 * R3 split (BackgroundJobsScreen) — premium gradient hero banner.
 *
 * Slate→indigo→slate gradient with two soft glow circles, a
 * "System Automation" pill, an H1 with gradient text, and a
 * Refresh Status button on the right. No state of its own.
 */
export function BackgroundJobsHeader({ loading, onRefresh }: BackgroundJobsHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl border border-indigo-900/30">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/20">
            <Sparkles className="h-3 w-3 text-indigo-400" /> System Automation
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">
            Background Jobs &amp; Reconciliation
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Monitor schedules, review wallet ledger integrity reports, and manually trigger system
            automation tasks for the Voltium platform.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
          size="default"
          className="self-start md:self-center border-slate-700 hover:bg-slate-800 text-white bg-slate-900/50 backdrop-blur-sm transition-all duration-300 gap-2 shrink-0 h-11 px-5 rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
        </Button>
      </div>
    </div>
  );
}
