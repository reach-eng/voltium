'use client';

import { Camera } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { MediaPreview } from '../helpers';
import type { Rider } from '@/lib/types/admin';

export interface RiderInspectionTabProps {
  rider: Rider;
}

export function RiderInspectionTab({ rider }: RiderInspectionTabProps) {
  return (
    <TabsContent
      value="inspection"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10">
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-sm font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <Camera className="w-5 h-5" /> Vehicle Pickup Photos
          </h4>
          <div className="text-[10px] font-bold uppercase text-rose-500/60 tracking-tighter">
            Required for Post-Active State
          </div>
        </div>
        {!rider.pickupPhotoFront &&
        !rider.pickupPhotoBack &&
        !rider.pickupPhotoLeft &&
        !rider.pickupPhotoRight &&
        !rider.pickupPhotoWithVehicle ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-3xl bg-background/50 text-center opacity-40">
            <Camera className="w-10 h-10 text-rose-500 mb-4" />
            <p className="text-sm font-black uppercase">No Pickup Photos</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Vehicle handover photos have not been uploaded yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <MediaPreview src={rider.pickupPhotoFront ?? null} label="Front View" />
            <MediaPreview src={rider.pickupPhotoBack ?? null} label="Rear View" />
            <MediaPreview src={rider.pickupPhotoLeft ?? null} label="Left Side" />
            <MediaPreview src={rider.pickupPhotoRight ?? null} label="Right Side" />
            <MediaPreview
              src={rider.pickupPhotoWithVehicle ?? null}
              label="With Vehicle"
            />
          </div>
        )}
      </div>
    </TabsContent>
  );
}
