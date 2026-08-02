'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Building2, Bike, Pencil, Trash2, Loader2 } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Hub } from './types';

interface HubGridProps {
  loading: boolean;
  hubs: Hub[];
  search: string;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  toggleLoading: string | null;
  onToggleActive: (hub: Hub) => void;
  onEdit: (hub: Hub) => void;
  onDelete: (id: string) => void;
}

export function HubGrid({
  loading,
  hubs,
  search,
  selectedIds,
  setSelectedIds,
  toggleLoading,
  onToggleActive,
  onEdit,
  onDelete,
}: HubGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    );
  }

  if (hubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MapPin className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">
          {search ? 'No hubs match your search' : 'No hubs added yet'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Checkbox
            checked={selectedIds.size === hubs.length && hubs.length > 0}
            onCheckedChange={(checked) =>
              setSelectedIds(checked ? new Set(hubs.map((hub) => hub.id)) : new Set())
            }
          />
          <span className="text-xs text-muted-foreground">
            Select All ({hubs.length})
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hubs.map((hub) => (
          <Card
            key={hub.id}
            className={selectedIds.has(hub.id) ? 'ring-2 ring-primary/30 bg-primary/[0.02]' : ''}
          >
            <CardHeader className="pt-5 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.has(hub.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(hub.id);
                      else next.delete(hub.id);
                      setSelectedIds(next);
                    }}
                  />
                  <div
                    className={`p-2 rounded-full bg-amber-500/10 ${!hub.isActive ? 'opacity-40' : ''}`}
                  >
                    <Building2
                      className={`h-6 w-6 ${hub.isActive ? 'text-amber-600' : 'text-muted-foreground'}`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-base leading-tight pb-1">{hub.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`mt-1 text-[10px] font-bold ${
                        hub.isActive
                          ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                          : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                      }`}
                    >
                      {hub.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-5">
              <div className="space-y-2 text-sm">
                {hub.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{hub.location}</span>
                    {hub.city && <span className="text-xs opacity-60">({hub.city})</span>}
                  </div>
                )}
                {hub.city && !hub.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{hub.city}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bike className="h-3.5 w-3.5" />
                  <span>
                    {hub._count?.vehicles ?? 0} vehicle
                    {(hub._count?.vehicles ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                {hub.vehicleBreakdown && (
                  <div className="mt-3 pt-3 border-t border-muted/30 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Available</span>
                      <span className="font-bold text-sm">
                        {hub.vehicleBreakdown.available}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                      <span>Assigned</span>
                      <span className="font-bold text-sm">{hub.vehicleBreakdown.assigned}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                      <span>Maintenance</span>
                      <span className="font-bold text-sm">
                        {hub.vehicleBreakdown.maintenance}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-500/5 border border-slate-500/10 text-slate-600 dark:text-slate-400 font-medium">
                      <span>Retired</span>
                      <span className="font-bold text-sm">{hub.vehicleBreakdown.retired}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Created: {formatDateDDMMYYYY(hub.createdAt)}
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant={hub.isActive ? 'outline' : 'default'}
                  size="sm"
                  disabled={toggleLoading === hub.id}
                  onClick={() => onToggleActive(hub)}
                >
                  {toggleLoading === hub.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : null}
                  {hub.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    aria-label="Edit hub"
                    onClick={() => onEdit(hub)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-red-500"
                    aria-label="Delete hub"
                    onClick={() => onDelete(hub.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
