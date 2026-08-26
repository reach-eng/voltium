'use client';

import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LocationPing } from './types';

interface LocationTabProps {
  locations: LocationPing[] | undefined;
}

function formatLatLng(loc: LocationPing): string {
  return `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
}

function formatAccuracy(loc: LocationPing): string {
  return `Accuracy: ${loc.accuracy?.toFixed(1) || '0'}m · Speed: ${loc.speed || '0'} km/h`;
}

/**
 * R3.7bb split — Live GPS sub-tab with radar + ping list.
 */
export function LocationTab({ locations }: LocationTabProps) {
  const hasLocations = locations && locations.length > 0;
  const current = hasLocations ? locations[0] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
          GPS Telemetry history
        </h4>
        <Badge className="bg-emerald-500 text-white border-0">Live Active</Badge>
      </div>
      <div className="aspect-video w-full rounded-2xl bg-slate-900 border-2 border-slate-800 flex flex-col items-center justify-center text-slate-400 group overflow-hidden relative p-6 shadow-[inset_0_0_100px_rgba(16,185,129,0.05)] dark:shadow-[inset_0_0_100px_rgba(16,185,129,0.1)]">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute inset-0 border border-emerald-500/30 rounded-full scale-150" />
          <div className="absolute inset-0 border border-emerald-500/30 rounded-full scale-100" />
          <div className="absolute inset-0 border border-emerald-500/30 rounded-full scale-50" />
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-emerald-500/30" />
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-500/30" />
          {hasLocations && (
            <div
              className="absolute inset-0 origin-center animate-[spin_4s_linear_infinite]"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 70%, rgba(16,185,129,0.4) 100%)',
              }}
            />
          )}
        </div>

        {current ? (
          <div className="relative z-10 flex flex-col items-center justify-center bg-slate-900/80 p-6 rounded-2xl backdrop-blur-sm border border-slate-800 shadow-xl">
            <MapPin className="w-12 h-12 mb-4 text-emerald-400 animate-pulse drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            <p
              className="text-3xl font-black text-white font-mono tabular-nums tracking-wider"
              style={{ textShadow: '0 0 10px rgba(255,255,255,0.2)' }}
            >
              {formatLatLng(current)}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-widest mt-4 text-emerald-400 bg-emerald-900/50 px-4 py-2 rounded-full flex items-center gap-2 border border-emerald-800/50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Telemetry Active
            </p>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center">
            <MapPin className="w-10 h-10 mb-4 opacity-40 group-hover:scale-110 transition-transform duration-500 text-emerald-500" />
            <p className="text-sm font-bold text-slate-300">No Location Data</p>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">
              Awaiting first GPS ping
            </p>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {locations?.map((loc, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-xl border bg-card/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-mono font-bold">{formatLatLng(loc)}</p>
                <p className="text-[10px] font-mono tabular-nums text-muted-foreground/60 uppercase mt-0.5">
                  {formatAccuracy(loc)}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] text-muted-foreground font-mono tabular-nums font-bold">
                {new Date(loc.timestamp).toLocaleTimeString()}
              </p>
              {loc.isMocked && (
                <Badge
                  variant="outline"
                  className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[9px] h-4 py-0 px-1"
                >
                  Mocked
                </Badge>
              )}
            </div>
          </div>
        ))}
        {(!locations || locations.length === 0) && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
            <p className="text-xs font-bold uppercase tracking-widest">
              Awaiting first GPS ping...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
