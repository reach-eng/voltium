'use client';

import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeviceTrackingHeaderProps {
  isStandalone: boolean;
  onChangeRider: () => void;
}

/**
 * R3.7bb split — page header with the "Change Rider" CTA.
 * Only rendered when the parent supplies a riderId via state
 * (i.e. the standalone entry path).
 */
export function DeviceTrackingHeader({
  isStandalone,
  onChangeRider,
}: DeviceTrackingHeaderProps) {
  if (!isStandalone) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Device Tracking</h2>
        <p className="text-muted-foreground text-sm">
          Viewing device telemetry and security controls.
        </p>
      </div>
      <Button
        variant="outline"
        size="default"
        onClick={onChangeRider}
        className="rounded-xl h-11 px-5"
      >
        <UserPlus className="w-5 h-5 mr-2" />
        Change Rider
      </Button>
    </div>
  );
}
