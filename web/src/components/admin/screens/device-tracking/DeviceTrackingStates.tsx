'use client';

import { MapPin, ShieldAlert } from 'lucide-react';

export function DeviceTrackingLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-pulse">
      <div className="w-12 h-12 rounded-full bg-muted mb-4" />
      <p className="text-sm font-medium tracking-tight">Syncing with user device...</p>
    </div>
  );
}

export function DeviceTrackingPermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-rose-500/5 rounded-2xl border border-rose-500/20 text-rose-600">
      <ShieldAlert className="w-12 h-12 mb-4 opacity-40" />
      <p className="text-lg font-bold">Access Denied</p>
      <p className="text-sm opacity-70">
        You do not have permission to view device telemetry.
      </p>
    </div>
  );
}

export function DeviceTrackingEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border border-dashed text-muted-foreground">
      <MapPin className="w-10 h-10 mb-4 opacity-20" />
      <p className="text-sm font-bold">No rider selected</p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        Search and select a rider above to view their device data.
      </p>
    </div>
  );
}
