'use client';

import { Smartphone, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import DeviceTrackingView from '../../DeviceTrackingView';
import { PERMISSIONS } from '../helpers';
import type { Rider } from '@/lib/types/admin';

export interface RiderPermissionsTabProps {
  rider: Rider;
}

export function RiderPermissionsTab({ rider }: RiderPermissionsTabProps) {
  return (
    <TabsContent
      value="device"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* Permission Matrix */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> Phone Permissions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PERMISSIONS.map((perm) => (
            <div
              key={perm.key}
              className="flex flex-col gap-1.5 p-3 rounded-xl border bg-muted/5"
            >
              <span className="text-[10px] font-bold uppercase text-muted-foreground/60">
                {perm.label}
              </span>
              <div className="flex items-center justify-between">
                {rider[perm.key] ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 w-fit gap-1 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Granted
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-rose-400 border-rose-400/20 w-fit gap-1 text-[10px]"
                  >
                    <ShieldAlert className="w-3 h-3" /> Required
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DeviceTrackingView riderId={rider.id} />
    </TabsContent>
  );
}
