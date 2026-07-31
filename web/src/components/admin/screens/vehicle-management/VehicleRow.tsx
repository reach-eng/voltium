'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { Battery, MapPin, Camera, History, Edit, Trash2 } from 'lucide-react';
import { statusColors, type Vehicle } from './types';

interface VehicleRowProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onOpenHistory: (vehicle: Vehicle) => void;
  onOpenEdit: (vehicle: Vehicle) => void;
  onDelete: (id: string) => void;
}

export function VehicleRow({
  vehicle,
  isSelected,
  onToggleSelect,
  onOpenHistory,
  onOpenEdit,
  onDelete,
}: VehicleRowProps) {
  const latestReturn = vehicle.returns?.[0];
  const activeLease = vehicle.leases?.[0];

  return (
    <TableRow
      className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onToggleSelect(vehicle.id, !!checked)}
        />
      </TableCell>
      <TableCell>
        <div>
          <p className="font-black text-sm">{vehicle.vehicleNumber}</p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">
            {vehicle.vehicleId}
          </p>
        </div>
      </TableCell>
      <TableCell className="text-sm font-medium">{vehicle.model}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm font-medium">
          <Battery className="w-3.5 h-3.5" />
          {vehicle.batteryLevel != null ? `${vehicle.batteryLevel}%` : '—'}
        </div>
        {vehicle.batteryPartner && (
          <p className="text-[10px] text-muted-foreground">
            {vehicle.batteryPartner}
          </p>
        )}
      </TableCell>
      <TableCell>
        {latestReturn?.photoFront ? (
          <div className="w-12 h-12 rounded-lg border bg-muted overflow-hidden relative group/img">
            <img
              src={latestReturn.photoFront}
              alt="Return"
              className="w-full h-full object-cover transition-transform group-hover/img:scale-125"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="w-3 h-3 text-white" />
            </div>
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground opacity-30">
            <Camera className="w-4 h-4" />
          </div>
        )}
      </TableCell>
      <TableCell>
        {activeLease ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-blue-600">
              {activeLease.rider.fullName}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase">
              {activeLease.rider.riderId}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Unassigned</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {vehicle.hub ? (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            {vehicle.hub.name}
          </div>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] font-black uppercase tracking-widest ${statusColors[vehicle.status] || ''}`}
        >
          {vehicle.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => onOpenHistory(vehicle)}
            title="View History"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => onOpenEdit(vehicle)}
            title="Edit Vehicle"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-rose-500 hover:text-rose-600"
            onClick={() => onDelete(vehicle.id)}
            title="Delete Vehicle"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
