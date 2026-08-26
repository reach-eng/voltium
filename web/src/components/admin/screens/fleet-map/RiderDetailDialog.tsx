'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, User } from 'lucide-react';
import { formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { getBatteryColor, getBatteryIcon, getRiderStatus, getStatusBadgeClass } from './fleetMapHelpers';
import type { FleetRider } from './types';

interface RiderDetailDialogProps {
  selectedRider: FleetRider | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * R3 split (FleetMapScreen) — rider detail dialog.
 *
 * Renders a single rider's status badge + battery, a metadata
 * table (phone, ID, vehicle, hub, team leader, last location),
 * and a Call / View Profile button row. Open state is derived
 * from `selectedRider` being non-null.
 */
export function RiderDetailDialog({ selectedRider, onOpenChange }: RiderDetailDialogProps) {
  const isOpen = !!selectedRider;
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {selectedRider?.fullName || selectedRider?.riderId}
          </DialogTitle>
        </DialogHeader>
        {selectedRider && <RiderDetailBody rider={selectedRider} />}
      </DialogContent>
    </Dialog>
  );
}

/** The dialog body — extracted to its own component so the hook
 * can render it without `selectedRider` being nullable. */
function RiderDetailBody({ rider }: { rider: FleetRider }) {
  const status = getRiderStatus(rider);
  const BatIcon = getBatteryIcon(rider.batteryLevel);
  const batColor = getBatteryColor(rider.batteryLevel);
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`rounded-md text-xs font-bold ${getStatusBadgeClass(status)}`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
        <span className={`flex items-center gap-1 text-sm font-semibold ${batColor}`}>
          <BatIcon className="w-4 h-4" />
          {rider.batteryLevel ?? 'N/A'}%
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Phone</span>
          <span className="font-medium">{rider.phone}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rider ID</span>
          <span className="font-mono text-xs">{rider.riderId}</span>
        </div>
        {rider.vehicle && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-medium">{rider.vehicle.vehicleNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model</span>
              <span>{rider.vehicle.model}</span>
            </div>
          </>
        )}
        {rider.pickupHub && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hub</span>
            <span>{rider.pickupHub}</span>
          </div>
        )}
        {rider.teamLeader && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Team Leader</span>
            <span>{rider.teamLeader}</span>
          </div>
        )}
        {rider.lastLocationAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Location</span>
            <span className="text-xs">{formatDateTimeDDMMYYYY(rider.lastLocationAt)}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          size="default"
          className="flex-1 h-11"
          onClick={() => window.open(`tel:${rider.phone}`)}
        >
          <Phone className="w-5 h-5 mr-2" />
          Call
        </Button>
        <Button variant="outline" size="default" className="flex-1 h-11">
          <User className="w-5 h-5 mr-2" />
          View Profile
        </Button>
      </div>
    </div>
  );
}
