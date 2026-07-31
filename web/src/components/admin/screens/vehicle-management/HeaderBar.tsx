'use client';

import { Button } from '@/components/ui/button';
import { ExportButton } from '../../export-button';
import { Plus } from 'lucide-react';
import type { Vehicle } from './types';

interface HeaderBarProps {
  filteredCount: number;
  totalCount: number;
  vehicles: Vehicle[];
  onAddClick: () => void;
}

/**
 * R3.7e split — Vehicle management header bar.
 *
 * Shows "{filtered} of {total} vehicle(s)" on the left, Export + Add
 * buttons on the right. The ExportButton reuses the same column shape
 * as the table — keep them in sync.
 */
export function HeaderBar({ filteredCount, totalCount, vehicles, onAddClick }: HeaderBarProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {filteredCount} of {totalCount} vehicle{totalCount !== 1 ? 's' : ''}
      </p>
      <div className="flex gap-2">
        <ExportButton
          data={vehicles.map((v) => ({
            vehicleId: v.vehicleId,
            vehicleNumber: v.vehicleNumber,
            model: v.model,
            licensePlate: v.licensePlate || '',
            status: v.status,
            hubName: v.hub?.name,
            batteryLevel: v.batteryLevel,
            batteryPartner: v.batteryPartner,
            createdAt: v.createdAt,
          }))}
          filename="vehicles"
          columns={[
            { key: 'vehicleId', label: 'Vehicle ID' },
            { key: 'vehicleNumber', label: 'Vehicle Number' },
            { key: 'model', label: 'Model' },
            { key: 'status', label: 'Status' },
            { key: 'hubName', label: 'Hub' },
            { key: 'batteryLevel', label: 'Battery Level' },
            { key: 'batteryPartner', label: 'Battery Partner' },
            { key: 'createdAt', label: 'Created At' },
          ]}
        />
        <Button size="default" className="rounded-xl h-11 px-5" onClick={onAddClick}>
          <Plus className="w-5 h-5 mr-1.5" />
          Add Vehicle
        </Button>
      </div>
    </div>
  );
}
