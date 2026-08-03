'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';
import {
  getBatteryColor,
  getBatteryIcon,
  getRiderStatus,
  getStatusColor,
} from './fleetMapHelpers';
import { LOW_BATTERY_THRESHOLD, type FleetRider } from './types';

interface RiderGridProps {
  riders: FleetRider[];
  onSelect: (rider: FleetRider) => void;
}

/**
 * R3 split (FleetMapScreen) — rider grid card.
 *
 * 4-10 column responsive grid. Each tile is a button with a
 * status dot (pulsing for active), a small battery icon, and the
 * rider's first name. Clicking a tile opens the detail dialog.
 * Empty state shows the Map icon + "No riders with location data".
 */
export function RiderGrid({ riders, onSelect }: RiderGridProps) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden lg:col-span-3">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="text-base font-bold">
          Rider Grid — {riders.length} with location
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {riders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-muted-foreground gap-2">
            <Map className="w-12 h-12 opacity-20" />
            <p>No riders with location data</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {riders.map((rider) => {
              const status = getRiderStatus(rider);
              const BatIcon = getBatteryIcon(rider.batteryLevel);
              const batColor = getBatteryColor(rider.batteryLevel);
              const isLowBattery = (rider.batteryLevel ?? 100) < LOW_BATTERY_THRESHOLD;

              return (
                <Button
                  variant="outline"
                  key={rider.id}
                  onClick={() => onSelect(rider)}
                  className={`relative group flex flex-col items-center justify-center p-2 min-h-[64px] h-auto rounded-xl border transition-all hover:scale-105 hover:shadow-md ${
                    isLowBattery
                      ? 'border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50'
                      : status === 'active'
                        ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
                        : status === 'idle'
                          ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40'
                          : 'border-slate-500/20 bg-slate-500/5 hover:border-slate-500/40'
                  }`}
                  title={`${rider.fullName || rider.riderId} — ${status}`}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor(status)} ${status === 'active' ? 'animate-pulse' : ''}`}
                  />
                  <BatIcon className={`w-3 h-3 mt-1 ${batColor}`} />
                  <span className="text-[9px] font-medium truncate w-full text-center mt-1">
                    {(rider.fullName || rider.riderId).split(' ')[0]}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
